import RunBotTestHarness from '../ui/tests/RunBotTestHarness.svelte';

/******** Component *******/

export default {
  title: 'RunBotTestHarness',
  component: RunBotTestHarness,
}


import diagnostic_test from '../dialog/tests/subscription.diagnostic.bot.page.support.js'; 

// Should show nothing initially but a Run button at bottom
// Run button which when clicked runs botConfig
// simulation of the publisher use case
export const runBotAfterLoad = () => ({
  Component: RunBotTestHarness,
  props: {
    botConfig: diagnostic_test,
    getConfigFromRemote: false,
    localStorageKey: 'test1',
    waitForStartNewConversation: true
  }
});