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
  let botBindingOne;
  let botBindingTwo;

  let previewBot = true;
  import Bot from "../Bot.svelte";

  function runOne() {
    botBindingOne.startNewConversation(botConfig);
    previewBot = true;
  }

  function runTwo() {
    botBindingTwo.startNewConversation(botConfig);
    previewBot = false;
  }


</script>


<!-- this mimic's publisher's parser/BotPreview.svelte use of 
previewBot that passes in the botConfig argument in the call
to startNewConversation() -->
<Bot
  botConfig={null}
  bind:this={botBindingOne}
  getConfigFromRemote={false}
  waitForStartNewConversation={true}
  localStorageKey={'key'}
/>


<button on:click={runOne}>Run with BotConfig arg in startNewConversation</button>
<br>
<hr>
<br>
<button on:click={runTwo}>Run with botConfig in prop</button>

<!-- this mimic's publisher's parser/Preview.svelte use of 
showGuideBot that uses the botConfig argument in the prop -->
<Bot
  botConfig={botConfig}
  bind:this={botBindingTwo}
  getConfigFromRemote={false}
  waitForStartNewConversation={true}
  localStorageKey={'key2'}
/>
