<!-- Test harness in the form of svelte component that
enables testing Bot.svelte's publisher scenario. In this scenario,
nothing is displayed until startNewConversation() is called.
This harness provides a button that is bound to Bot.svelte, 
enabling calling that function. 

Took this approach because couldn't find another way for storybook
to call a bound function on a component. Also couldnt find a way 
for testing library's automated tests to check shadowDOM. In this 
implementation we just do a visual spot check that the function 
call is passed through correctly and nothing is displayed until
the function is called.
-->

<script>
  export let botConfig;
  let botBinding;

  import Bot from "../Bot.svelte";

  function run() {
    botBinding.startNewConversation(botConfig);
  }


</script>

<Bot
  botConfig={botConfig}
  bind:this={botBinding}
  getConfigFromRemote={false}
  waitForStartNewConversation={true}
  localStorageKey={'key'}
/>

<button on:click={run}>Run</button>
