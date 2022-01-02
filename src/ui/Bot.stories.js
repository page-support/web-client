import Bot from './Bot.svelte';
import { action } from '@storybook/addon-actions';

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

  props: { propBotConfig: diagnostic_test,
           localStorageKey: 'diagConvOne'
  }
  //on: { click: action('clicked') },
});


export const multiSelectConversation = () => ({
  Component: Bot,

  // Pass props and bindings into component

  props: { propBotConfig: multi_select_test,
           localStorageKey: 'multiSelect' }
   
});

export const imagesTest = () => ({
  Component: Bot,

  // Pass props and bindings into component

  props: { propBotConfig: images_test,
           propGetConfigFromRemote: false,
           localStorageKey: 'imagesTest' }
   
})