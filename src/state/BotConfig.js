/* 
 * This file contains the js object data structure used to store the 
 * configuration needed to define the behavior of page.support compliant bots. 
 * 
 * Page.support applications have two parts:
 *   1. a publisher used by bot creators
 *   2. a bot UI client that interacts with end users
 * 
 * Page.support publisher apps create this data structure described in this 
 * file and bot clients use it to drive the conversation in the bot's UI. This
 * file defines as narrow an interface as possible between publishers and 
 * clients to decouple publishers and clients and facilitate an ecosystem on
 * both sides. This file should avoid including information that is only relevant 
 * to specific implementations of a publisher or bot. 
 * 
 * This config does NOT contain any runtime or user information. If 
 * a user answers a question, that answer string goes into a separate data 
 * structure resident on the client. In the Bot reference implementation this 
 * is the conversation data structure. In general, clients don't share runtime 
 * data with publisher applications. Bot clients may share user replies with
 * other server side APIs however for logging, personalization, etc.
 *
 * A bot models a set of Frames that are used for a particular purpose.
 * For instance, a business might have a bot that screens leads for sales,
 * and another bot that answers support inquiries for existing customers. Each 
 * of these may be one Frame.
 * 
 * This file should define the conversation with the user not the implementation  
 * of the conversation. This configuration should allow any page.support compliant 
 * bot to have the same conversation with a user - ask the same questions and 
 * accept the same replies. 
 * 
 * Different bot client implementations may enable different UI cosmetic designs
 * (colors, fonts, CSS, sizes), UI types (native mobile vs web), and different 
 * communication methods (voice, text, etc) and platforms (vendor specific 
 * chat apps like Whatsapp, Fb messenger, SMS, etc)
 * 
 * In addition to the javascript object, this file contains a set of Lenses
 * that may be used to access the object. 
 * 
 */



/******************* Imports ******************/
import { lensPath, lensProp, set, view, concat } from 'ramda';
import { BUILT_IN_REPLIES } from './BuiltInReplies.js';


/******************* Bot Configuration Factory Functions ******************/

/****************** Bot ********************/


/* 
 * Returns object that initializes of all the data needed for one Bot, defined as 
 * what is produced from a single publisher document parsing.  Equates
 * to what runs on a single page in the client.  Note that you have to return an object
 * literal not an already-created object in order for the returned object to be new
 * otherwise any changes to the returned object will remain so it won't be usable
 * as a constructor.
 */ 
export const newBot = () => ({
  version: '2.0.0',
  publisherId: '',
  publisherName: '',
  publisherPhone: '',
  publisherLogoUrl: '',
  publisherApiKeys: [],    // [{apiUrl: '', apiKey: ''},..]

  /* A frame is a collection of slots the bot will attempt to fill
  * along with the replies it will accept from the user.  Which 
  * slots it tries to fill depend on the condition
  */
  frames: {},  // See newFrame constructor

  /* Defines the first frame Bot will execute - useful when there
   * is no multi-frame routing or only one frame - lets 
   * startNewConversation() in Bot.svelte execute the first frame.
   * Value is a String UUID assigned by publisher that is the key
   * to the frames object above.
   */
  startFrameId: '',

  /* Map/Object of all Replies that may be accepted in a slot fill, keyed
   * with the (unique) name of the reply. 
   * Reply names must be unique inside a bot. Reply names are case-sensitive 
   * and can contain Unicode letters, $, _, and digits (0-9), but may not 
   * start with a digit. Reply name is the key in the reply object.  The 
   * value is an array of strings shown to the user to select from.
   */
  replies: Object.create(BUILT_IN_REPLIES),

  // Clients which store publisher specific info on supported external
  // integrations like API webhooks.
  clients: Object.create(null),
  
  
  botSettings: botSettings,

});


/********************* Frames & Phrasings **********************/


/* 
 * Frame factory function returns new object that initializes one frame.  
 * A Frame groups together a set of Slots for the purpose of responding to 
 * a specific request from a user. The frame contains
 *  - a name to help the bot publisher identify it
 *  - a set of phrasings that define when the Frame is triggered
 *  - a set of triggers that define when each Slot in the Frame is triggered
 * 
 * A Frame is associated with
 *  - a bot which has a one to many relationship with frames
 * 
 */
export const newFrame = () => ({ 
  
  name: '',   // REQUIRED: name identifies this bot in metrics, publisher
              //  UI, etc. comes from value after query: property in tag
     
  introduction: '',  // String, OPTIONAL: introduction is spoken or 
                     // displayed to user when bot first runs, 
                     // used to explain what will happen next to the user. 
                     // Comes from md after the query tag.   
  
  // REQUIRED
  localeString: 'en-US',  // unicode locale string used by bot client for 
                          // sorting and other language specific toggles
                          // TODO make this settable in the publisher.

  // REQUIRED
  phrasings: [], // list of user question Strings that will trigger this frame.

  // OPTIONAL
  slots: [],  // list of Slots - run slots with null trigger or trigger evals to true, 
                // trigger evaluated left to right in array.
});

// Lens into phrasings Array
export const phrasingsLens = (frameId) => lensPath(['frames', frameId, 'phrasings']);

// Lens into the frames and frame Array
export const startFrameIdLens = lensProp('startFrameId');
export const allFramesLens = lensProp('frames');
export const frameLens = (frameId) => lensPath(['frames', frameId]);
export const NamePropLens = lensProp('name');
export const frameNameLens = (frameId) => lensPath(['frames', frameId, 'name']);
export const frameIntroductionLens = (frameId) => lensPath(['frames', frameId, 'introduction']);
// the frame objects, without their frameId keys, flattened into an Array
// this allows indexing into specific frames but note that retrieval by
// order insertion is not guaranteed in x-browser scenarios, which means it
// does usually work for testing.
export const allFramesArray = (bot) => Object.values(view(allFramesLens, bot));


/***************  Slots *******************/


/* Slot factory function returns new slot object.
 * Slots represent one round of conversation where the bot says something
 * to the user and accepts a reply back.  Slots include all types of 
 * conversation, including
 *    - asking the user for information, e.g. "what type of restaurant?"
 *    - asking the user to perform a task for diagnostic e.g. "click the 
 *       gear icon to open settings" and then waiting for a reply that 
 *       indicates they have completed the task.
 *    - giving the user an answer to a question or making a recommendation
 *       e.g. "ProductName is the best package for your situation." then 
 *       waiting for a reply to indicate if the user accepts the 
 *       recommendation and wants to finish the conversation.
 * 
 * Slots are associated with 
 *   - one Reply which defines what responses are accepted from the user
 */
export const newSlot = ({ name = '',
                          type = '',
													ask = '',
                          replyId = '',
													trigger = '',
                        }) => ({
    // the variable reference in trigger conditions that evals to the user's reply
    // id = uuid(), TODO add uuid function
    name,       // String: REQUIRED UNIQUE if slot is being used in another slot's 
                // trigger. Optional if not being used in a trigger, e.g an answer
                // type slot that is terminal in the conversation.
                // Added as UUD by parser for diagnostics.  Allows triggers to refer
                // to the value the user replies with, should be unique in a bot.
                // Parser will set to null if the slot doesn't provide a name, e.g. 
                // in answers.
    type,       // String: REQUIRED: describes the type of reply this slot
                // accepts and how the UI is shown. See slotTypeEnum for allowed values.           
    ask,        // String: REQUIRED: what the bot asks or requests to the user. This 
                // property may come from inside or outside the tag. To enable the client to 
                // render the ask (which might have several links, images, text blocks) adapted
                // to various screen sizes, the String is markdown.
                // Images referenced in links must be hosted elsewhere since this config doesn't
                // account for their storage.  For phone numbers, publishers use 
                // [123-456-7890](tel:1234567890) and the client will create the appropriate link
                // type for the given platform.
    replyId,    // String: REQUIRED & ADDED BY PARSER if type is 'single',
                // 'multiple' or 'diagnostic'. Its the name of the reply this slot
                // will accept. OPTIONAL if type is 'answer'
                // The reply is identified either by being in the same comment tag,
                // or a reference added by user. This is the same as the property 
                // used to id the reply in replyObjLens. 
    trigger,    // String: OPTIONAL. If expression evals to true, '' or property is undefined, run 
                // this slot. Otherwise don't. Evaluate triggers in order slot appears in Frame. 
                // Expression must be a valid js expression with reply function as defined
                // in the tutorial. Parser.js transforms publisher syntax 
                // into js expression so js not exposed to the user. Not updated
                // by publisher code, this is purely user input that is validated
                // with provisional eval but not changed by parser.  
});


// slotTypeEnum defines how the bot client handles the slot. Its written by the 
// publisher and read by the client. 
export const slotTypeEnum = Object.freeze({ 
  
  // Single tells client to present a list of options to the user and let
  // then pick one.
  single: 'single', 
  
  // Multiple tells client to present a list of options to the user and let
  // then pick one OR MORE. 
  multiple: 'multiple', 
  
  // Diagnostic tells the client to ask the user to complete an action then
  // report back when the user is done. What distinguishes the diagnostic 
  // type from the 'single' type is that the client doesn't care about storing
  // or using the user's answer beyond knowing when they have completed a task
  // for the purposes of moving to the next slot. If the outcome of completing
  // the task needs to be used by a backend or a trigger use 'single' instead.
  // Clients only care about completion so in text interfaces can omit 
  // presenting the user with a list of options
  // like in 'single' slots, and just show a 'done' button for the user to click.
  diagnostic: 'diagnostic', 
  
  // newTabAnswer tells the client to open a new tab after the user replies, 
  // for example by putting the reply into search URL and loading it into a 
  // new tab.
  newTabAnswer: 'newTabAnswer', 
  
  // Answer tells the client that this slot is at the end of a Frame - no
  // reply is expected from the user. Its used to give the user a final
  // answer to an intent, e.g. recommend a product/action, give a diagnosis, etc.
  // Publishers should not associate a reply with this type of slot. 
  answer: 'answer',
  
  // endConversation signals to the UI that there is no next slot, i.e. the 
  // conversation is over.
  endConversation: 'endConversation'
});


// Lenses (getters/setters) into Slot object's properties
export const slotNameLens = (frameId, slotIndex) => 
  lensPath(['frames', frameId, 'slots', slotIndex, 'name']);
export const slotAskLens = (frameId, slotIndex) => 
  lensPath(['frames', frameId, 'slots', slotIndex, 'ask']);
export const slotLinkLens = (frameId, slotIndex) => 
  lensPath(['frames', frameId, 'slots', slotIndex, 'link']);
export const slotImageLens = (frameId, slotIndex) => 
  lensPath(['frames', frameId, 'slots', slotIndex, 'image']);
export const slotPhoneLens = (frameId, slotIndex) => 
  lensPath(['frames', frameId, 'slots', slotIndex, 'phone']);
export const slotReplyIdLens = (frameId, slotIndex) => 
  lensPath(['frames', frameId, 'slots', slotIndex, 'replyId']);
export const slotTypeLens = (frameId, slotIndex) => 
  lensPath(['frames', frameId, 'slots', slotIndex, 'type']);
export const slotTriggerLens = (frameId, slotIndex) => 
  lensPath(['frames', frameId, 'slots', slotIndex, 'trigger']);
export const slotIsTriggeredLens = (frameId, slotIndex) => 
  lensPath(['frames', frameId, 'slots', slotIndex, 'isTriggered']);
export const slotsLens = (frameId) => 
  lensPath(['frames', frameId, 'slots']);
// Unlike slotNameLens, this one operates on an element of the slot array
// used for uniqueness checks.
export const slotNameElementLens = lensProp('name');



// Return the slot object whose name === the name in the argument. Looks across
// all frames (the whole bot where each slot as a unique name)
// Returns null if no slot has that name
export function getSlotByName( name = '', bot = {} ) {
  for (const frame of allFramesArray(bot)) {
    for (const slot of frame.slots) {
      if (slot.name === name) return slot;
    }
  }
  return null;
}



/****************** Replies ********************/

/* Replies are defined by the user, saved into the Bot's
 * replies object with the reply's name as the key and value is
 * an array of allowed replies we'll accept from the user.
 */  
      

// Lens into a specific value in a reply's Array of possible user replies
// 'name' is used in the slot's replyId property to identify the unique 
// reply since reply names are unique in the reply object is a Map with reply
// name keys
export const replyValuesLens = (name, valueIndex) => 
    lensPath(['replies', name, valueIndex]);
// Lens into a given reply, identified by the replyName argument which is the
// key in the replies Object.    
export const replyObjLens = (name) =>
    lensPath(['replies', name]);
export const replyLens = lensProp('replies');



/********** Client bot Cosmetics configuration ***********/

/* Bot client CSS cosmetic customization including fonts and colors. Set by
 * Publishers based on user input. Settings defined here are defaults used
 * if publisher or user hasn't overriden them. Generally the values here
 * need to be written to config files elsewhere then applied in a server 
 * side build step before they can be used in the bot. 
 * The emulator in the publisher uses these default values
 * to avoid having to do a high latency build before starting. Emulation can 
 * optionally call a server side build and load a new set of html and css
 * from a server side build.
 */
export const botSettings = {
  // Leave these properties as is if client should use the specified defaults.
  // defaults. Note have to ALSO change Bot.svelte's style section to change 
  // the defaults. Publisher can optionally set other values and have them
  // used in the bot/client.
  
  /******** COLORS *******/

    /* these defaults are from the colors.sky palette in tailwindcss
     * https://tailwindcss.com/docs/customizing-colors#color-palette-reference
     */

  // Primary is used for button backgrounds where the user can 
  // perform an action and the like   
  primaryColor: '#38bdf8', 
  
  // Secondary is for non-actionable backgrounds like conversation history
  // that the user said
  secondaryColor: '#e0f2fe',
  
  // Hover is what primary changes to when mouse hovers over it.
  hoverColor: '#0ea5e9', 
  
  /* background of the whole bot container */
  containerBg: '#F9FAFB',  
  
  /* border of the whole bot container */
  containerBorderBg: '#f0f9ff', 

  trackUserReplies: false,
  
  /********* FONTS ********/

  // value is a list of font family names 
  // https://developer.mozilla.org/en-US/docs/Web/CSS/font-family
  // applied to all elements in the client including buttons and user and 
  // client generated text. Value is a string.
  customerFont: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'"
};

export const botSettingsLens = (name) => lensPath(['botSettings', name]);










