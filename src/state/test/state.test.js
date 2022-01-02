/************** State Tests ******************/

/* TODO: remote fetch not fully implemented or tested yet, 
 *       ignore this file until that is done.
 * Pre-requisites: .vscode directory in same parent directory as 
 *                 the talk.code-workspace file for vscode.  In that dir,
 *                 a launch.json file. (has been checked into github)
 * 
 * To run test in VScode debugger:
 *    - put cursor in the test file you want to run
 *    - select debugger in R sidebar
 *    - click run icon in upper right with "Jest watch current file" selected
 *    - add breakpoints in code to see variables automatically shown 
 *    - add logpoints with variables inside {xyz} to be interpolated
 *    - add breakpoint at end of test (at put test at top of file) to
 *      to just run one test.
 * 
 *  If you get "Can'find node" error when running debugger, might need to
 *  click "create javascript debugger" in the drop down on right in Terminal.
 *  This launches a new shell that has the right settings.  Sometimes this 
 *  requires restarting vscode.
 * 
 *   Fixtures with markdown MUST have indentation exactly same as md file
 *   i.e. most lines start at left margin since md is indentation sensitive.
 * 
 * To run a specific test in console outside vscode debugger (in terminal) 
 *     npm run test slot.test.js -t 'Scenario C'
 *  where the string is a regex match
 * 
 * Debugger configuration in talk/.vscode/launch.json
 *  
 * See https://www.basefactor.com/using-visual-studio-code-to-debug-jest-based-unit-tests
 * for the file added to /.vscode/launch.json and see
 * https://github.com/microsoft/vscode-recipes/tree/master/debugging-jest-tests
 * And for general debugger tutorials https://code.visualstudio.com/docs/editor/debugging
 */    


// jest/nodejs doesn't include the browser Fetch api, so use
// https://www.npmjs.com/package/jest-fetch-mock to mock network/api requests
// See the "setup for an individual test" section for the below
import { enableFetchMocks } from 'jest-fetch-mock';
enableFetchMocks();

// initializations for reading test fixtures
const fs = require('fs'), path = require('path');       

import { fetchBotConfigFromRemote } from '../state.js';

beforeEach(() => {
  fetch.resetMocks()
})

/*************** Setup Tests (getting configs from remote..)  **************/

/* . NOT IMPLEMENTED YET
test('getBotConfig gets config', () => {
  const url = "http://test.com";
  const configText = fs.readFileSync(path.join(__dirname, '../../dialog/tests/imagesTest.js'), 
        'utf8');
  fetch.mockResponseOnce(configText);
  expect.assertions(1);
	fetchBotConfigFromRemote(url).then(res => {
    expect(res.frames[res.startFrameId].name).toBe("how to cancel a subscription");
  });
});

*/
  