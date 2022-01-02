/************** Mixin that implements trigger evaluation ****************/

// Everything needed to evaluate a trigger.  Used in both client and publisher 

// Globals in this module used for parser init
// See https://github.com/silentmatt/expr-eval#parserevaluateexpression-string-variables-object
const Parser = require('expr-eval').Parser
export const triggerParser = new Parser();


/************ Imports ***************/
import * as config from '../state/BotConfig.js';



/* formulaFactory() => function
 * Returns an instance the function defined in comparisonFunction with caller's
 * lexical scope allowing the syntax written by the publisher to 
 * avoid including repliesAsProps as an argument. All comparisons between
 * user replies and trigger 
 * Args: 
 *    - repliesAsProps object returned by askedSlotResponsesAsProp()
 *    - comparisonFunction is a reference to one of our home grown functions like
 *      hasSameMembers()
 *    - bot is instance of botConfig, which lets us check the user entered 
 *      formula for slot references that don't exist in the slot list.
 * 
 * See: https://github.com/silentmatt/expr-eval#pre-defined-functions
 * to use
 * Usage: triggerParser.functions.isEqual = formulaFactory(repliesAsProps, 
 *                                                         comparisonFunc);
 *        call the factory each time a new replieseAsProps is available, i.e.
 *        at the end of each round of conversation. 
 * Note: we're comparing indexes not values, so we don't need to include
 *       the name of pre-defined slots when it differs from the slot name.
 *       As long as the trigger writer was looking at the right reply index
 *       the formula will return the correct value. Same goes for diagnostics
 *       where the UUID based slot.name is different from the 'done' built in.
 */
export function formulaFactory(repliesAsProps, comparisonFunction, bot = null) {
  
  // Evaluate a trigger for a given slot, using the existing
  // set of answered slots (repliesAsProps), return boolean
  // Defines custom functions used by publishers in triggers described
  // here https://github.com/silentmatt/expr-eval#custom-javascript-functions
  // Note that because we're comparing indexes not values in repliesAsProps,
  // it doesn't matter if the slot is re-using a reply with a different name 
  // than the slot. The publisher that gives us the indexes uses
  // the reply they specified with the slot, making the semantic meaning of the
  // reply values the same for publisher and user.
  // Args for the trigger function written by the publisher:
  //   - REQUIRED: slotName : String is unique name of the slot stored in bot
  //   - REQUIRED: triggerTrueIndexes: Array of publisher-specified 0 based
  //               integer indexes to compare to the userReplyIndexes array. 
  // Returns: boolean
  return (slotName, triggerTrueIndexes) => {
    
    if (!slotName || Array.isArray(slotName)) throw new slotTriggerError(
      `The first argument in a trigger formula must be a question name.`); 

    // Error if the trigger references a non-existent slot name. Only run
    // this if bot passed in, which occurs when called by validateSlotTrigger()
    // but not by getNextSlot()
    if (bot && !config.getSlotByName(slotName, bot)) throw new slotTriggerError(
       `The question name "${slotName}" does not exist. Possibly a typo?
       Correct typo or add ${slotName} to a tag so the trigger can evaluate it.`);

    if (!triggerTrueIndexes || triggerTrueIndexes.length == 0) throw new slotTriggerError(
      `Trigger formulas must have one or more indexes as the second argument
        - check triggers that include ${slotName}`);

    // get the indexes of the user reply(s) input by the user from round.
    const userReplyIndexes = repliesAsProps[slotName];

    // When running the bot: if the slot hasn't been filled/answered by the user 
    // yet, treat the whole trigger as false.  This will occur due to the linear
    // nature of the config file whose execution of each ask is a tree. 
    // Execution will skip irrelevant/unanswered parts of the list.
    if (!userReplyIndexes) { 
        return false;
    }

    // Compare the index(s) in the trigger (triggerTrueIndexes) to what the user 
    // picked (userReplyIndexes)
     return comparisonFunction(userReplyIndexes, triggerTrueIndexes);
  }
}    



/* hasSameMembers(arrayA, arrayB) => boolean
 * Returns true if arrays a and b have same length, same primitive
 * elements, in ANY order.  False otherwise.  
 * Don't use for for non-primitive elements that can't be compared with ===
 */
export function hasSameMembers(arrayA, arrayB) {
  if (!Array.isArray(arrayA) || !Array.isArray(arrayB)) {
    throw new Error('hasSameMembers() called with non-array argument');
  } 
  const a = [...arrayA].sort(); // make copies since sort modifies in place
  const b = [...arrayB].sort(); 
  return a.length === b.length && a.every((val, index) => val === b[index]);
}



/* isSubset(subSetArray = [], superSetArray = []) => boolean
 * Returns true if all of subSetArray's members exist in superSetArray. Order 
 * is not important, but all elements must be primitives. False otherwise.  
 * Don't use for non-primitive elements that can't be compared with ===
 */
export function isSubset(subSetArray, superSetArray) {
  if (!Array.isArray(subSetArray) || !Array.isArray(superSetArray)) {
    throw new Error('isSubSet() called with non-array argument');
  } 
  return subSetArray.every( el => superSetArray.includes(el) );
}



/* hasOneOrMoreSharedMember(subSetArray = [], superSetArray = []) => boolean
 * Returns true if at least one of subSetArray's members exist in superSetArray. 
 * Order is not important, but all elements must be primitives. False otherwise.  
 * Don't use for non-primitive elements that can't be compared with ===
 */
export function hasOneOrMoreSharedMember(subSetArray, superSetArray) {
  if (!Array.isArray(subSetArray) || !Array.isArray(superSetArray)) {
    throw new Error('hasOneOrMoreSharedMember() called with non-array argument');
  } 
  
  for (let val of subSetArray) { 
    if (superSetArray.includes(val)) return true;
  } 
  return false; // if no el of subSetArray is included in superSetArray
}


export function replyEvalFunction(replyName = '', valueIndex = null) {
  // if valueIndex present, return String of that value
  if (valueIndex) {
    return view(config.replyValuesLens(replyName, valueIndex), bot);
  } else {

    // if not present, return Array of all values so caller can use
    // it in 'in' expression
    return view(config.replyObjLens(replyName), bot);
  }
};



/* Evaluate a single slot trigger and return a boolean result.
 * Raise an instance of slotTriggerError() if parsing fails.
 * Uses https://github.com/silentmatt/expr-eval to parse the expresssion
 * 
 * Prerequisites: caller must first set reply function in lexicalcontext of a bot
 *    for example: parser.functions.reply = config.replyEvalFunction; 
 * See parser.js replyEvalFunction for an example of usage.
 */
export function evaluateSlotTrigger(trigger, slotResponsesAsProperties) {
  // check that trigger and slotResponses are not empty
  if (!trigger) throw new slotTriggerError(`Trigger argument must not be empty.`);
  
  // Scenario where first slot has a trigger, but slotResponsesAsProperties is 
  // empth because there are no preceeding slots.
  if (Object.keys(slotResponsesAsProperties).length === 0) { 
    throw new slotTriggerError(`Adding a trigger to ` +  
      `the first slot is unnecessary since the first slot will always execute.`);
  }

  try {
    // parser may return non-boolean which means the user input a bad trigger
    // TODO: passing in slotResp.. probably not needed anymore since the three functions
    // obviate the need for regular equality checking 
    const result = triggerParser.evaluate(trigger, slotResponsesAsProperties);
    if (typeof result === 'boolean') {
      return result;  // Success!
    } else {
      throw new slotTriggerError(`Triggers must evaluate to true or false.  
                                  "${trigger}" did not.`);
    }
  } catch (e) {
    console.log(e);
    throw new slotTriggerError(`${e} in "${trigger}"`);
  }
}




export function slotTriggerError(message) {
	this.name = 'Trigger Missing Or Invalid';
  this.message = message;
  // example and docAnchorHTML are rendered as HTML by the view below the error
  this.exampleHTMLStr = `Example:<br>
    slot.trigger: same('TOSAccepted', [0])<br><br>`;
	this.stack = (new Error()).stack;
}
slotTriggerError.prototype = new Error;

