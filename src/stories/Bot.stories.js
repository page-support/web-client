import Bot from '../ui/Bot.svelte';


/******** Component *******/

export default {
  title: 'Bot',
  component: Bot,
}


import diagnostic_test from '../dialog/tests/subscription.diagnostic.bot.page.support.js'; 
import multi_select_test from '../dialog/tests/multiSelect.page.support.js';
import images_test from '../dialog/tests/imagesTest.js';

/****** stories *****/

export const diagnosticConversationOne = () => ({
  Component: Bot,

  // Pass props and bindings into component

  props: { botConfig: diagnostic_test,
           localStorageKey: 'diagConvOne',
           // test non-default css file uri
           cssFileURI: './page-support-bot-bundle.css'
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


// Should not display anything of the waitForStartNewConversionTrue prop is true
export const waitForStartNewConversionTrue = () => ({
  Component: Bot,

  // Pass props and bindings into component

  props: { botConfig: null,
           getConfigFromRemote: false,
           localStorageKey: 'imagesTes1t',
           waitForStartNewConversation: true
           }
   
});

