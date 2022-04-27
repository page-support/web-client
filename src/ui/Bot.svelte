<!-- GUI part of the Page.Support Client Component

*** Introduction

This is a Svelte component responsible for rendering questions 
and replies in a web context. It includes js modules (dialog.js and
state.js) that determine what questions the bot asks and maintain conversation
state. For more on Svelte visit https://svelte.dev/

*** Production usage and testing
  
Import this component as an IIFE or ES6 module into your site. See the README 
in this repository for information on how to integrate with your site. The 
README also covers testing using Storybook.
   
Note that this component will show an unfriendly error if called without a valid
botConfig. The calling site is responsible for passing in props including the 
botConfig. For example:
 
    <Bot botConfig={guideBotConfig} 
         bind:this={guideBotBinding} 
         getConfigFromRemote={false}
         localStorageKey={'guideBot'} 
         waitForStartNewConversation={false} /> 

-->
<script>
  /*************** Exports ************/

  /* Exported functions */

  // See https://svelte.dev/tutorial/bind-this for usage examples
  export { startNewConversation };

  /* Exported Props:
   * All props should be passed in. Some have defaults, but for
   * code readability, pass in all of them.
   */

  // Prop: OPTIONAL: Instance of Bot return from newBot() in src/state/BotConfig.js
  // If botConfig is static, i.e. not retrieved from a remote server,
  // it must be passed into this prop OR passed in with startNewConversation()
  // This prop is also used in Storybook testing.
  export let botConfig = null;

  // Prop: OPTIONAL: bool : For now this must be false, because remote retrieval of
  // botConfig is not supported. In a future release you can set this to true,
  // provide a URL
  export let getConfigFromRemote = false;

  // Prop: OPTIONAL: String : The URL from which to retrieve the botConfig, currently unused.
  // When this is supported, getBotConfig() needs to pass this prop into
  // fetchBotConfigFromRemote() to enable using it. The latter currently
  // uses a constant URL defined in state.js
  // export let botConfigRemoteURL = null;

  // Prop: REQUIRED: String key used to save bot state to localStorage and sessionStorage.
  // Must be unique at the domain level.
  export let localStorageKey;

  // Prop: OPTIONAL: URI where the bot's css file is located. The value is used to
  // set the href property of a link. This allows the parent site flexibility about
  // where to put the css file. If not provided, uses the CSS_FILE constant, which
  // assumes the file is in the same directory as the js executables which will
  // be true if bot is imported from an npm package - since both js and css are
  // in the dist folder
  export let cssFileURI;


  // Prop: OPTIONAL: Boolean true if this component should display nothing until
  // startNewConversation() is called. This allows <Bot> to be added to the DOM
  // and a binding to <Bot> be avaliable to caller so it can be used. Without
  // this option you get into a catch-22 where the component can't be rendered
  // because it lacks a BotConfig, but component has to be rendered for the
  // loading code to get a binding to the component to call startNewConversation.
  export let waitForStartNewConversation = false;


 

  /*************** Imports ******************/

  import { onMount } from "svelte";
  import BotConversationUI from "./BotConversationUI.svelte";

  /************ variables used in the UI/DOM **********/

  // reference to BotConversationUI.svelte component. set in init()
  let botConversationUI;

  /********* Constants ******************/

  // file is in /dist, path relative to built index.*.* files which works 
  // if css file is loaded from npm package where the js executables are in 
  // the dist directory
  const CSS_FILE = './page-support-bot-bundle.css';

  /********* Lifecycle Event handling *************/

  onMount(() => {
    init();
  });

  // Create Bot UI component, attach to #botShadowRoot, bind the component
  // reference to startNewConversation
  function init() {
    // create shadowRoot
    const parent = document.getElementById("botShadowHost");
    const shadow = parent.attachShadow({ mode: "open" });

    // add link element that loads css to shadowDOM Tree.
    loadCSS(shadow);
  }


  // load CSS and attach to el. 
  function loadCSS(el) {
    const link = document.createElement('link');

    link.rel  = 'stylesheet';
    link.type = 'text/css';
    link.href = (cssFileURI || CSS_FILE);

    el.appendChild(link);

    // attach BotConversationUI component when stylesheet loaded
    link.onload = attachNewBotUI(el);
  }

  
  // instantiate component and attach to shadowDOM Tree after css loaded
  function attachNewBotUI(target) {
    botConversationUI = new BotConversationUI({
      target: target,
      props: {
        waitForStartNewConversation: waitForStartNewConversation,
        localStorageKey: localStorageKey,
        getConfigFromRemote: getConfigFromRemote,
        propBotConfig: botConfig,
      },
    });
  }

  

  /***************** UI functions ***************/

  // pass-thru that just calls the function of the same name in
  // BotConversationUI.svelte.
  function startNewConversation() {
    // pass in botConfig, which might be null. the second argument sets
    // startNewConversation in BotConversationUI to true, triggering a new
    // conversation even if an old one is on progress.
    botConversationUI.init(botConfig, true);
  }
</script>

<div id="botShadowHost" />
