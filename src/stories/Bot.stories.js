import Bot from '../ui/Bot.svelte';

export default {
  title: 'Bot',
  component: Bot,
}

import diagnostic_test from '../dialog/tests/subscription.diagnostic.bot.page.support.js'; 
import multi_select_test from '../dialog/tests/multiSelect.page.support.js';
import images_test from '../dialog/tests/imagesTest.js';


export const diagnosticConversationOne = () => ({
  Component: Bot,

  // Pass props and bindings into component

  props: { botConfig: diagnostic_test,
           localStorageKey: 'diagConvOne'
  }
  //on: { click: action('clicked') },
});


export const multiSelectConversation = () => ({
  Component: Bot,

  // Pass props and bindings into component

  props: { botConfig: multi_select_test,
           localStorageKey: 'multiSelect' }
   
});

export const imagesTest = () => ({
  Component: Bot,

  // Pass props and bindings into component

  props: { botConfig: images_test,
           getConfigFromRemote: false,
           localStorageKey: 'imagesTest' }
   
})