/**
 * @jest-environment jsdom
 */

// docblock above needed to avoid test environment error in console and 
// https://jestjs.io/docs/configuration#testenvironment-string

/* Tests for the Bot.svelte component 
 * 
 * This file is for testing how Bot interacts with the DOM
 * at the component level. To test visual rendering with different 
 * arguments and botConfigs see the Storybook tests in src/stories.
 * 
 * This file is for automated tests, including calling the 
 * startNewConversation() exported function. See the tests
 * directories under src/dialog and src/state for unit tests of
 * specific function internal to Bot. 
 * 
 * API for @testing-library/svelte used below:
 *   https://testing-library.com/docs/svelte-testing-library/
 *   https://testing-library.com/docs/queries/about/#types-of-queries
 * 
 * References and examples:
 *   https://www.thisdot.co/blog/component-testing-in-svelte
 *   https://sveltesociety.dev/recipes/testing-and-debugging/unit-testing-svelte-component/
 *   https://testing-library.com/docs/svelte-testing-library/example
 *   https://timdeschryver.dev/blog/how-to-test-svelte-components#writing-a-test
 */



import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/svelte';
// note these Tests don't work with Bot.svelte because they
// cannot access shadowDOM, but should work with BotConversationUI.svelte
import Bot from '../BotConversationUI.svelte';


/* TODO: redo this for BotConversationUI automated tests. 
* these imports pull in JSON files used as test fixtures and passed
 * into the Bot component as props. 
import botConfigDiagnostic from '../../dialog/tests/subscription.diagnostic.bot.page.support.js';   

test('Bot renders diagnostic first round and introduction', async () => {
  const results = render(Bot, {
    props: {
      botConfig: botConfigDiagnostic,
      getConfigFromRemote: false,
      localStorageKey: 'imagesTest',
      waitForStartNewConversation: true
    }
  });


  await results.component.startNewConversation(botConfigDiagnostic);
  console.log(JSON.stringify(results, null, 2));
  expect(() => results.getByText(
    container: HTMLElement,
    'About canceling a subscription')).not.toThrow();
   
  let root = results.container.getElementById('botShadowHost');
  console.log(root);
  let rootShadow = root.shadowRoot;
  console.log(rootShadow);
  // check presence of introduction and first round say.ask text
  expect(() => rootShadow.getByText('About canceling a subscription')).not.toThrow();
  expect(() => rootShadow.getByText('What type of device are you on?')).not.toThrow();
  
});

*/