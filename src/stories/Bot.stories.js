/* Debug suggestions
 * 
 * "npm run storybook" yields no output to browser and no errors:
 * try deleting node_modules/.cache/storybook then stop storybook and restart
 * by running "npm run storybook" again
 * 
 */


import Bot from '../ui/Bot.svelte';


/******** Component *******/

export default {
  title: 'Bot',
  component: Bot,
}


import diagnostic_test from '../dialog/tests/subscription.diagnostic.bot.page.support.js'; 
import multi_select_test from '../dialog/tests/multiSelect.page.support.js';
import images_test from '../dialog/tests/imagesTest.js';
import settings_test from '../dialog/tests/settingsTest.js';

/****** stories *****/

export const diagnosticConversationOne = () => ({
  Component: Bot,

  // Pass props and bindings into component

  props: { botConfig: diagnostic_test,
           localStorageKey: 'diagConvOne',
           // test non-default css file uri
           cssFileURI: 'page-support-bot-bundle.css'
  }
});


export const multiSelectConversation = () => ({
  Component: Bot,

  // Test default css file uri

  props: { botConfig: multi_select_test,
           localStorageKey: 'multiSelect'
         }
   
});

export const imagesTest = () => ({
  Component: Bot,

  // Pass props and bindings into component

  props: { botConfig: images_test,
           getConfigFromRemote: false,
           localStorageKey: 'imagesTest'
           }
   
});

// Show display green container background, and red primary color (button bg).
// Note that container border color and secondary-color settings are 
// unused and the former doesn't work for some reason.
// Testing customization via settings in botConfig.jsqq
export const settingsTest = () => ({
  Component: Bot,

  // Pass props and bindings into component

  props: { botConfig: settings_test,
           getConfigFromRemote: false,
           localStorageKey: 'settingsTest'
           }
   
});


// Should not display anything since the waitForStartNewConversionTrue prop is true
export const waitForStartNewConversionTrue = () => ({
  Component: Bot,

  // Pass props and bindings into component

  props: { botConfig: null,
           getConfigFromRemote: false,
           localStorageKey: 'imagesTes1t',
           waitForStartNewConversation: true
           }
   
});

