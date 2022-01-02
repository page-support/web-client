/************** dialog.js Tests ******************/

/* Tests of getNextSlot() and its dependencies. getNextSlot() returns
 * markdown, which Bot.svelte turns into HTML and enables interaction.
 * This file doesn't test the UI, it only tests if getNextSlot() returns
 * the correct slot given a conversation's history and a botConfig instance.
 * 
 * To run test in VScode debugger:
 *    - put cursor in the test file you want to run
 *    - select debugger in R sidebar
 *    - select "Jest watch current file" in drop down in upper right
 *    - add breakpoints in code to see variables automatically shown 
 *    - add logpoints with variables inside {xyz} to be interpolated
 *    - To just run one test: start it with test.only('My Test'..) 
 *    - click the green > play sign where the drop down is on upper right to run
 * 
 * To run just one tst
 *  If you get "Can'find node" error when running debugger, might need to
 *  click "create node debugger" in the drop down on right in Terminal.
 *  This launches a new shell that has the right settings.
 * 
 *   Fixtures with markdown MUST have indentation exactly same as md file
 *   i.e. most lines start at left margin since md is indentation sensitive.
 * 
 * To run a specific test in console outside vscode debugger (in terminal) 
 *     npm test -- -t 'Answer'
 *  where the string is a regex match
 * 
 * Debugger configuration in talk/.vscode/launch.json
 *  
 * See https://stackoverflow.com/questions/42827054/how-do-i-run-a-single-test-using-jest
 *     for ways to invoke from command line 
 * See https://www.basefactor.com/using-visual-studio-code-to-debug-jest-based-unit-tests
 * for the file added to /.vscode/launch.json and see
 * https://github.com/microsoft/vscode-recipes/tree/master/debugging-jest-tests
 * And for general debugger tutorials https://code.visualstudio.com/docs/editor/debugging
 */    

import { getNextSlot, initConversation, saveReply, ENDINGS } from '../dialog.js';
import { saveBotState } from '../../state/state.js';

/* these imports pull in JSON files used as test fixtures
 * the imported name will be an object */
import testAConfig from './subscription.diagnostic.bot.page.support.js';   
import testBConfig from './triggering.fixture.js';

const localStorageKey = 'testkey';


test('Answers 3', () => {
  let completedRounds, replyType, replyOptions;
  saveBotState(testBConfig, localStorageKey);
  initConversation(testBConfig, testBConfig.startFrameId , localStorageKey);

  ({completedRounds, replyType, replyOptions} = getNextSlot(localStorageKey));
  
  // First round
  expect(completedRounds[0].slot.ask).toBe('Ask one');
  saveReply({ userReplyValues: [replyOptions[1]], // more than month
              userReplyIndexes: [1], 
              ending: ENDINGS.completed,
              stats: {},
              localStorageKey: localStorageKey});
  
  // Second round
  ({completedRounds, replyOptions} = getNextSlot(localStorageKey));
  expect(completedRounds[1].slot.ask).toBe('Ask Two');
  saveReply({ userReplyValues: [replyOptions[1]], // Feature phone
              userReplyIndexes: [1], 
              ending: ENDINGS.completed,
              stats: {},
              localStorageKey: localStorageKey}); 

  // Third round 
  ({completedRounds, replyOptions} = getNextSlot(localStorageKey));
  expect(completedRounds[2].slot.ask).toBe('Ask three');
  saveReply({ userReplyValues: [replyOptions[1]], // Europe
              userReplyIndexes: [1], 
              ending: ENDINGS.completed,
              stats: {},
              localStorageKey: localStorageKey});

  // Last round bot should recommend last answer
  ({completedRounds, replyOptions} = getNextSlot(localStorageKey));
  expect(completedRounds[3].slot.ask).toMatch(/Last answer/);
});


// Verizon test case using test_verizon_answers.json
test('Answers 2', () => {
  let completedRounds, replyOptions;
  saveBotState(testBConfig, localStorageKey);
  initConversation(testBConfig, testBConfig.startFrameId, localStorageKey);

  ({completedRounds, replyOptions} = getNextSlot(localStorageKey));
  
  // First round
  expect(completedRounds[0].slot.ask).toBe('Ask one');
  saveReply({ userReplyValues: [replyOptions[0]], // less than month
              userReplyIndexes: [0], 
              ending: ENDINGS.completed,
              stats: {},
              localStorageKey: localStorageKey});
  
  // Second round
  ({completedRounds, replyOptions} = getNextSlot(localStorageKey));
  expect(completedRounds[1].slot.ask).toBe('Ask Two');
  saveReply({ userReplyValues: [replyOptions[0]], // smartphone
              userReplyIndexes: [0], 
              ending: ENDINGS.completed,
              stats: {},
              localStorageKey: localStorageKey}); 

  // Third round 
  ({completedRounds, replyOptions} = getNextSlot(localStorageKey));
  expect(completedRounds[2].slot.ask).toBe('Ask three');

  saveReply({ userReplyValues: [replyOptions[2], replyOptions[3]], 
              userReplyIndexes: [2, 3], 
              ending: ENDINGS.completed, 
              stats: {},
              localStorageKey: localStorageKey});

  // Last round bot should recommend Unlimited
  ({completedRounds, replyOptions} = getNextSlot(localStorageKey));
  expect(completedRounds[3].slot.ask).toMatch(/second to last answer/);
});





// Verizon test case using test_verizon_answers.json
test('Answers 1', () => {
  let completedRounds, replyType, replyOptions;
  console.log(JSON.stringify(testBConfig, null, 2));
  saveBotState(testBConfig, localStorageKey);
  initConversation(testBConfig, testBConfig.startFrameId, localStorageKey); // uses verizon.bot.page.support.json in Publisher

  ({completedRounds, replyType, replyOptions} = getNextSlot(localStorageKey));
  
  // First round
  expect(completedRounds[0].slot.ask).toBe('Ask one');
  saveReply({ userReplyValues: [replyOptions[0]], // less than month
              userReplyIndexes: [0], 
              ending: ENDINGS.completed, 
              stats: {},
              localStorageKey: localStorageKey});
  
  // Second round
  ({completedRounds, replyType, replyOptions} = getNextSlot(localStorageKey));
  expect(completedRounds[1].slot.ask).toBe('Ask Two');
  saveReply({ userReplyValues: [replyOptions[0]], 
              userReplyIndexes: [0], 
              ending: ENDINGS.completed,
              stats: {},
              localStorageKey: localStorageKey}); 

  // Third round 
  ({completedRounds, replyType, replyOptions} = getNextSlot(localStorageKey));
  expect(completedRounds[2].slot.ask).toBe('Ask three');
  saveReply({ userReplyValues: [replyOptions[0], replyOptions[1]], 
              userReplyIndexes: [0, 1], 
              ending: ENDINGS.completed,
              stats: {},
              localStorageKey: localStorageKey});

  // Last round 
  ({completedRounds, replyType, replyOptions} = getNextSlot(localStorageKey));
  console.log(JSON.stringify(completedRounds, null, 2));
  expect(completedRounds[3].slot.ask).toMatch(/first answer/);
});




test('Diagnostic 1', () => {

  let completedRounds, replyOptions;
  saveBotState(testAConfig, localStorageKey);
  initConversation(testAConfig, testAConfig.startFrameId, localStorageKey);  // Using 'dialog/tests/subscription.diagnostic.bot.page.support.json' as input
  ({completedRounds, replyOptions} = getNextSlot(localStorageKey));
  
  // First round pick the product
  expect(completedRounds[0].slot.ask).toBe('What type of device are you on?');
  saveReply({ userReplyValues: [replyOptions[1]], 
              userReplyIndexes: [2], 
              ending: ENDINGS.completed,
              stats: {},
              localStorageKey: localStorageKey});
  
  // Second round
  ({completedRounds, replyOptions} = getNextSlot(localStorageKey));
  //console.log(completedRounds);
  expect(completedRounds[1].slot.ask).toMatch('1. Open the Settings app.');
  saveReply({ userReplyValues: [replyOptions[0]], 
              userReplyIndexes: [0], 
              ending: ENDINGS.completed,
              stats: {},
              localStorageKey: localStorageKey}); 

  // Last round after 4 done clicks by user. We don't test the concluding
  // end-of-conversation statement since that's implemented elsewhere
  ({completedRounds, replyOptions} = getNextSlot(localStorageKey));
  saveReply({ userReplyValues: [replyOptions[0]], 
              userReplyIndexes: [0], 
              ending: ENDINGS.completed,
              stats: {},
              localStorageKey: localStorageKey});
  ({completedRounds, replyOptions} = getNextSlot(localStorageKey));
  saveReply({ userReplyValues: [replyOptions[0]], 
              userReplyIndexes: [0], 
              ending: ENDINGS.completed,
              stats: {},
              localStorageKey: localStorageKey});            
  ({completedRounds, replyOptions} = getNextSlot(localStorageKey));

  saveReply({ userReplyValues: replyOptions[0], 
              userReplyIndexes: [0], 
              ending: ENDINGS.completed,
              stats: {},
              localStorageKey: localStorageKey});          
  ({completedRounds, replyOptions} = getNextSlot(localStorageKey));

  saveReply({ userReplyValues: [replyOptions[0]], 
              userReplyIndexes: [0], 
              ending: ENDINGS.completed,
              stats: {},
              localStorageKey: localStorageKey});              
  expect(completedRounds[5].slot.ask).toBe(`5. [Tap Cancel Subscription](https://example.com) If you don’t see Cancel Subscription, the subscription is already canceled and won't renew.`);
});





