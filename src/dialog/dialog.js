/* dialog.js handles dialog policy - what to say next given the current 
 * conversation state and bot configuation. 
 *
 */

/************************* Exports **********************/

// called by UI client like Bot.svelte to determine what to say to user next
export { getNextSlot };
// called by UI client Bot.svelte to start a new conversation
export { initConversation };
// called by UI client like Bot.svelte when user edits a previously answered slot
// the conversation will rewind back to the previous slot and start again.
export { rewindConversation };
// called by UI client view after user answers to save user replies 
export { saveReply, ENDINGS, newRound };

/**************** Imports *************************************/

import { getConversation, saveConversation } from '../state/state.js';
import { evaluateSlotTrigger, 
         triggerParser, 
         hasOneOrMoreSharedMember, 
         isSubset, 
         hasSameMembers,
         replyEvalFunction,
         formulaFactory }
  from './TriggerEvaluation.js'
import { getBotConfig } from '../state/state.js';
import { clone } from 'ramda';
import { slotTypeEnum } from '../state/BotConfig.js';


/**************** CONSTANTS and Declarations ******************/



/***************** Constructors *******************************/


/* Constructor for Conversation objects that tracks everything said by bot and 
 * human in this session. Includes all frames the user engages with in a session.
 * Args:
 *   frames: bot.frames (from newBot constructor in BotConfig.js)
 *   allReplyOptions: Array of strings user selects from in UI
 *   botSettings: the botConfig property that styles the GUI 
 */
const newConversation = ({ frames = [], 
                           currentFrame = '',
                           replies = {}, 
                           botSettings = {}
                         }) => ({
  // in VO.1 this is fixed to zero since we don't have server side NLU
  // to select the frame using phrasings. When this changes, also change 
  // the index to frames in localeString below
  currentFrame: currentFrame,  // Index into the frame Array in BotConfig 
  
  // Unicode locale identifier string used for lexicographic sorting and other
  // language specific handling.
  localeString: frames[currentFrame].localeString,

  // used in Bot.svelte to display intro at start of frame conversation
  introduction: frames[currentFrame].introduction,
  
  // Copy of botConfig.frames with already served slots removed so we don't 
  // re-evaluate their triggers and repeat questions.
  unSpokenFrames: clone(frames),   // frames is an array

  // Chronologically ordered Array of Round objects.
  // Enables editing earlier answers and showing history in GUI. 
  completedRounds: [],

  allReplyOptions: clone(replies),
  botSettings: botSettings
});


/* Constructor for instance of a conversation Round that tracks everything that  
 * was said in one convesation Round.  Each Round is appendded to 
 * conversation.completedRounds[] when populated with bot question and user reply.
 * Used to:
 *   track history of the conversation and related stats for display in UI
 *   evaluate triggers based on replies user has already given
 */
const newRound = ({ slot = {},
                    frameId = '',
                    userReplyValues = [],
                    userReplyIndexes = [],
                    ending = '',
                    stats = {} }) => ({
    slot,          // Object: the whole Slot object as defined in BotConfig.js
    frameId,    // String: name of the frame this slot belongs to
    userReplyValues,   // Array of Strings: the values said or clicked by the user   
    userReplyIndexes,  // Array of Integers: indexes of the replies in replyValues.
    // one element in array if type: single, possibly > 1 if 
    // type:multiple, empty if free form input
    ending,        // String: how the round ended: one of the enum ENDINGS
    stats          // Object: Any stats we want to track on a per-round basis
  });


// Standardized recording of how round ended, optionally populated by
// UI clients that want to log this info. Note this is NOT about how the 
// conversation ended, just the round. The conversation end cannot be recorded
// in the user reply, as it requires a reply to be processed and all the
// triggers evaluated before concluding if the conversation is over.
const ENDINGS = Object.freeze({
  completed: 'completed',         // user gave valid reply
  invalidReply: 'invalidReply',   // user gave invalid reply
  abandoned: 'abandoned',         // user gave no reply, disappeared
  chatAgent: 'chatAgent',         // user gave no reply, clicked chat agent
  callAgent: 'callAgent'          // user gave no reply, clicked call agent
});


/****************** Functions **********************************/


/* initConversation() => Conversation instance or null if error
 * Start a new conversation from the beginning. Return empty conversation tracker 
 * object to UI component. This object, in conjunction with functions in this 
 * file enable Bot.svelte to handle all of the UI rendering including history.
 * 
 * Returns Conversation object or null if botConfig invalid or missing
 * 
 * See scenarios in Bot.svelte for usage.
 * 
 * Args
 *    bot: REQUIRED: instance of botConfig or null if none. If null, some other
 *        mechanism must be calling saveState to save a config, such as runBot()
 *    currentFrame: REQUIRED: integer
 *    localStorageKey: REQUIRED: unique-per-domain key where conversation state
 *    and botConfig are stored.
 * 
 */
function initConversation(bot, currentFrame, localStorageKey) {
  if (bot === undefined || 
      currentFrame === undefined || 
      localStorageKey === undefined) {
    console.log(`initConversation(): an argument is undefined: 
      bot:${bot}\ncurrentFrame:${currentFrame}\nlocalStorageKey:${localStorageKey}`);
    return null;
  }
  
  // if we get here we have all the required arguments, create new conversation 
  const newConv = newConversation({ frames: bot.frames,
    currentFrame: currentFrame,
    replies: bot.replies,
    botSettings: bot.botSettings
  }); 

  // persist to sessionStorage and return it
  saveConversation(newConv, localStorageKey);
  return newConv;
}



/* getNextSlot() 
 * Return the whole Round history to the UI so it can display the ask and the
 * user replies to the user. History includes the latest ask in a Round, stored
 * in the last element in the completedRounds array. 
 * This function is the interface to Bot.svelte which manages the UI. 
 * Scenarios:
 *   1) in publisher: publisher calls startNewConversation(newBot) which 
 *      caches newBot as the botConfig and inits a new conversation tracker.
 *      no botConfig argument needed.
 *   2) in 3P site: botConfig will be null, causing fetchBotConfigFromRemote()
 *      to fetch and cache a botConfig in localStorage.  No botConfig argument.
 *   3) Storybook passes in the testBotConfig prop from Bot.stories.js into
 *      loadConversation() which passes it in to this function's botConfig arg
 *      only the call to getNextSlot() in loadConversation needs to pass it in,
 *      it will be cached after the first load. 
 * 
 * Args: REQUIRED: localStorageKey is used to save state to localStorage
 * 
 * Returns: Object { 
 *   completedRounds: conversation.completedRounds,   # Array of Rounds
 *   replyType:nextSlot.type # a property of config.slotTypeEnum
 *   allReplyOptions: [String,..] # String replies the user picks
 *                                  from for this ask
 *   }   
 *         
 *   or returns null if we're at the end of the conversation.
 */
function getNextSlot(localStorageKey) {
  // use existing conversation if tracker exists, otherwise start new conversation
  const conversation = getConversation(localStorageKey);

  // get slots for current frame
  // TODO: when > 1 frames, need to change this to all slots in all frames
  const slotCandidates =
    conversation.unSpokenFrames[conversation.currentFrame].slots

  // put all the replies so far into object for use by trigger parser  
  const repliesAsProps = askedSlotResponsesAsProp(conversation.completedRounds);

  // assign custom functions to trigger parser so it can eval triggers.
  // pass in bot and replies as Props for context to factory functions.

  // Naming: "user replies have same member indexes as trigger indexes in formula"
  triggerParser.functions.same = formulaFactory(repliesAsProps,
    hasSameMembers);
  // Naming: "user replies are a subset of trigger indexes in formula"
  triggerParser.functions.subset = formulaFactory(repliesAsProps,
    isSubset);
  // Naming: "user replies share some members as trigger indexes in formula"                                                  
  triggerParser.functions.share = formulaFactory(repliesAsProps,
    hasOneOrMoreSharedMember);

  // Description: "returns the value for the indicated pre-defined reply"
  triggerParser.functions.reply = formulaFactory(repliesAsProps, 
    replyEvalFunction);

  const nextSlot = returnFirstTrueSlotTrigger(slotCandidates, repliesAsProps);

  if (nextSlot === undefined) {
    // If no slot was found we're at the end of the conversation.
    return {
      completedRounds: clone(conversation.completedRounds),
      replyType: slotTypeEnum.endConversation,
      replyOptions: null
    }
  
  } else {
    // if slot not already there, e.g. because user refreshed page, add slot
    if (conversation.completedRounds.length === 0 ||
        (conversation.completedRounds.length > 0 && 
         nextSlot.name !== conversation.completedRounds
           [conversation.completedRounds.length - 1].slot.name) ) {
      // create and save the slot portion of the round in the conversation tracker
      // leaving recording of the reply to saveReply() after user replies
      const round = newRound({
        slot: clone(nextSlot),
        frameId: conversation.currentFrame,
      });
      conversation.completedRounds.push(round);
      saveConversation(conversation, localStorageKey);
    }

    // return what UI needs to present next ask to user. Clone it so UI specific
    // transformations don't affect the recorded conversation. 
    return {
      completedRounds: clone(conversation.completedRounds),
      replyType: clone(nextSlot.type),
      replyOptions: clone(conversation.allReplyOptions[nextSlot.replyId])
      }
    }
  }

  

/* rewindConversation() => undefined or null if error
  * Add answered slots after the index back to slot candidate list
  * so user can redo their reply at the rewoundRoundIndex reply. Also
  * remove those replies from completedRounds.
  * 
  * Args: ALL REQUIRED
  *   rewoundRoundIndex: int the index the user is rewinding to, ie. re-answering
  *   getConfigFromRemote: boolean, false if not triggering remote botConfig fetch
  *   localStorageKey: unique key for this bot's conversation in sessionStorage
  */
function rewindConversation(rewoundRoundIndex, getConfigFromRemote, localStorageKey) {
  if (rewoundRoundIndex === undefined || 
      getConfigFromRemote === undefined || 
      localStorageKey === undefined) {
    console.log(`rewindConversation(): an argument is undefined: 
      rewoundRoundIndex:${rewoundRoundIndex}\ngetConfigFromRemote:${getConfigFromRemote}\nlocalStorageKey:${localStorageKey}`);
    return null;
  }

  const conversation = getConversation(localStorageKey);

  // remove rounds from rewoundRoundIndex to the end of completedRounds array
  conversation.completedRounds = 
    conversation.completedRounds.slice(0, rewoundRoundIndex);

  // Reset unSpokenFrames to conversation start point, then remove slots
  // present in completedRounds. We don't want to get a new botConfig nor
  // force a remote reload, so both args are false.
  const bot = getBotConfig(false, 
                           getConfigFromRemote, 
                           localStorageKey,
                           false);
  conversation.unSpokenFrames = clone(bot.frames); 
  
  conversation.completedRounds.forEach((round) => {
    removeUnspokenSlot(conversation, round)
  });

  // Persist the conversation rewind
  saveConversation(conversation, localStorageKey);
}


/* removeUnspokenSlot(conversation: Conversation, round: Round) => undefined
 * Removes slots from the slot candidate list (unSpokenFrames.[index].slots) 
 * when a user answers the slot question. Updates conversation tracker.
 */
function removeUnspokenSlot(conversation, round) {
  // find the index of the slot using its unique name property
  const slotIndexToRemove =
    conversation.unSpokenFrames[conversation.currentFrame].slots.findIndex(
      slot => slot.name === round.slot.name);

  // remove the slot at that index to avoid re-triggering
  conversation.unSpokenFrames[conversation.currentFrame].slots.splice(
    slotIndexToRemove, 1);
}


/* returnFirstTrueSlotTrigger() => instance of a Slot or false if trigger invalid
 * evaluates slot triggers and return the first slot whose trigger is 'true' or
 * empty string or the expression evaluates to boolean true
 * Args:
 *   slotCandidates: REQUIRED: conversation.unSpokenFrames[conversation.currentFrame].slots
 *   repliesAsProps: REQUIRED: see askedSlotResponsesAsProp()
 */
function returnFirstTrueSlotTrigger(slotCandidates, repliesAsProps) {

  return slotCandidates.find(slot => {
    try {
      return ((slot.trigger === '') ||
              (slot.trigger === undefined) ||
              (slot.trigger === 'true') ||
              evaluateSlotTrigger(slot.trigger, repliesAsProps))
    } catch (e) {
      // Evaluations of replies to slots that are untraveled will return false
      // This is normal. 
      if (e.name === 'triggerMissingOrInvalidError') {
        console.log(e);
        return false;
      } else {
        throw e;
      }
    }
  });
}

  
  /* saveReply() => undefined
   * Update conversation tracker with just-executed reply AND
   * remove the just-presented slot. Used by UI clients like Bot.svelte when 
   * user replies. 
   * Note: This function does NOT do user input validation. TODO. When it does,
   * calling it should be wrapped in a try block by the 
   * caller and caller should handle showing the error message. At the moment
   * Bot.svelte only allows selecting from a system-provided list, so unless 
   * the user goes out of their way to hack an invalid reply, errors won't occur
   * but this will change if free text or voice is allowed.
   * Args:
   *   See newRound() constructor and ENDINGS constant for definitions.
   *   All are required, but stats may be empty object.
   */
  function saveReply({ userReplyValues, 
                       userReplyIndexes, 
                       ending, 
                       stats, 
                       localStorageKey }) {

    const conversation = getConversation(localStorageKey);
    // record the new user reply in the existing round created by getNextSlot()
    // which is the last round object in the array.
    const round = conversation.completedRounds[conversation.completedRounds.length - 1];

    round.userReplyValues = userReplyValues;
    round.userReplyIndexes = userReplyIndexes;
    round.ending = ending;
    round.stats = stats;

    // Remove the slot contained in round from the current conversation so
    // it doesn't trigger in the future (because user answered it)
    removeUnspokenSlot(conversation, round);

    // Persist the conversation
    saveConversation(conversation, localStorageKey)

    // call the global namespace function that publishers may use for logging.
    if (conversation.botSettings.trackUserReplies) {
      try {
        pageSupportBotTracker('replyClick', {
          ask: round.slot.ask,
          userReplyValues: round.userReplyValues,
          userReplyIndexes: round.userReplyIndexes,
          ending: round.ending }
        );
      } catch (e) {
        console.error(`page.support bot tracker is turned on in your bot configuration but not configured correctly. 
See the documentation and make sure you've added a function called 
pageSupportBotTracker() to you global namespace.`);
      }
    }
  }




  /***************** Trigger Evaluation Functions ************/


  /* askedSlotResponsesAsProp() => {}
   * Enables evaluating trigger expressions using completedRounds.
   * Args: 
   *   instance of completedRounds as defined in the conversation constructor
   *  
   * Returns an object in the form 
   *  { slotName1: replyIndexArray1, slotName2: replyIndexArray2, .. } or
   *  { gender: [0], countries: [3, 4, 1] }
   * 
   * For single-response replies each replyIndexArray only has the first index
   * populated. The index in that array is an integer index into the 
   * replyValues for the slot.  For multi-response replies, any number might be populated. 
   * The returned object includes all slots in all frames that have been 
   * answered by the user. 
   *
   * Used in: client after each round of conversation.  
   */
  function askedSlotResponsesAsProp(completedRounds) {
    let returnObj = {};
    completedRounds.forEach(round => {
      returnObj[round.slot.name] = round.userReplyIndexes;
    });
    return returnObj;
  }
