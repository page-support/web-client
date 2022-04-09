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
 
    <Bot propBotConfig={guideBotConfig} 
         bind:this={guideBotBinding} 
         propGetConfigFromRemote={false}
         localStorageKey={'guideBot'} /> 

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
  export let propBotConfig = null;

  // Prop: OPTIONAL: bool : For now this must be false, because remote retrieval of
  // botConfig is not supported. In a future release you can set this to true,
  // provide a URL
  export let propGetConfigFromRemote = false;

  // Prop: OPTIONAL: String : The URL from which to retrieve the botConfig, currently unused.
  // When this is supported, getBotConfig() needs to pass this prop into
  // fetchBotConfigFromRemote() to enable using it. The latter currently
  // uses a constant URL defined in state.js
  // export let botConfigRemoteURL = null;

  // Prop: REQUIRED: String key used to save bot state to localStorage and sessionStorage.
  // Must be unique at the domain level.
  export let localStorageKey;

  // Prop: OPTIONAL: Boolean true if this component should display nothing until
  // startNewConversation() is called. This allows <Bot> to be added to the DOM
  // and a binding to <Bot> be avaliable to caller so it can be used. Without
  // this option you get into a catch-22 where the component can't be rendered
  // because it lacks a BotConfig, but component has to be rendered for the
  // loading code to get a binding to the component to call startNewConversation.
  export let waitForStartNewConversation = false;

  /*************** Imports ******************/

  
  
  import { initConversation, rewindConversation } from "../dialog/dialog.js";
  import {
    getConversation,
    getBotConfig,
    saveBotState,
    versionCompatible,
    invalidBotConfig
  } from "../state/state.js";
  
  import { ENDINGS } from "../dialog/dialog.js";
  import { BUILT_IN_REPLIES } from "../state/BuiltInReplies.js";
  import { dropLast } from "ramda";
  import { onMount } from 'svelte';
  import { marked } from 'marked'; 
  import { slotTypeEnum } from "../state/BotConfig.js";
  import MultiSelect from "./MultiSelect.svelte";
  import { afterUpdate, tick } from "svelte";

  /************ variables used in the UI/DOM **********/

  let localeString; // String: unicode locale string used for language specific sorting
  let completedRounds; // Object: populates conversation history in view
  let replyOptions; // Array of Strings: replies the user can select from
  let showReplyOptions; // boolean: true diplays the replyOptionsModal, false hides
  let replyType; // String: one of slotTypeEnum in BotConfig.js
  let selectedReplyIndex; // Integer: index of reply user selected in single select
  let userText = ""; // String: free text user input
  let inputError = ""; // String: error displayed for free text user input
  // String: if present, shows intro at beginning of frame's
  // presentation, before any slots get shown.
  let frameIntroduction = "";
  let UIError = ''; // error show in UI, e.g. if botConfig doesn't load or invalid


  // Show loading indicator when in process of fetching
  // botConfig from remote.
  let showLoadingWaitUI = false;

  // Show unfriendly error if loading botConfig or conversation fails.
  // If set to false, could be a bug, botConfig version issue, or some
  // other botConfig loading issue.
  let showUnfriendlyError = false;

  // Displays a restart conversation button if true.
  // Only needed for testing to restart the bot in a multi bot scenario like
  // in storybook. Real user doesn't have this situation, and can just click
  // edit on whatever userReply they want to change to rewind the bot.
  let showRestartButton = propBotConfig ? true : false;

  /********* Constants ******************/

  // Currently the page.support publisher is able to create botConfigs
  // for multiple frames. However this Bot.svelte component does 
  // not support multiple frames - it lacks a way to for the user to 
  // transition from one frame to another. So at UI load time we 
  // need to set currentFrame to the first frame in botConfig so that 
  // startNewConversation() knows which frame to execute. Frames
  // are keyed with a UUID assigned by the publisher, so botConfig has
  // a startFrameId property to tell us where to start. currentFrame is
  // set at botConfig load time in loadBotConfig();
  let currentFrame = null;  

  /********* Lifecycle Event handling *************/

  // load the botConfig and conversation object so UI can be rendered
  loadConfigAndConversation(
      propBotConfig,
      localStorageKey,
      propGetConfigFromRemote,
      waitForStartNewConversation
  );

  // Responsible for all GUI loading scenarios in this component
  // loadConfigAndConversation() has to run first before UI may be rendered,
  // and showBotUI() and setBotSettings() need the DOM in place.
  onMount(() => { 
    // show the UI unless containing site wanted to wait for explicit trigger
    if (!waitForStartNewConversation) showBotUI(); 
  });

  /* loadUI() => undefined
   * Load botConfig, conversation, and show view.
   * Args:
   *   localStorageKey: REQUIRED: String, unique to this bot
   *   propBotConfig: OPTIONAL: instance of BotConfig from state/BotConfig.js
   *   propGetConfigFromRemote: REQUIRED: Boolean true if BotConfig should
   *     be fetched from remote URL
   *   waitForStartNewConversation: REQUIRED: Boolean true if UI should NOT be
   *     loaded until startConversation() is called with a BotConfig argument.
   * Scenarios:
   *  a) Containing site wants to load Bot component but not display it until
   *     runBot() is called and (usually) a botConfig is passed in via
   *     startNewConversation().
   *     Args:
   *         propBotConfig: null
   *         waitForStartNewConversation: true
   *         propGetConfigFromRemote: true | false
   *     loadUI() should display nothing until startNewConversation() called.
   *     If there is a cached botConfig in localStorage it should be used. This
   *     covers the case where user refreshed page after startConversation() was
   *     called.
   *     waitForStartNewConversation: true allows <Bot> to be added to the DOM
   *     and a binding to <Bot> be avaliable to caller so it can be used. Without
   *     this option you get into a catch-22 where the component can't be rendered
   *     because it lacks a BotConfig (if no remote), but component has to be
   *     rendered for the loading code to get a binding to the component to call
   *     startNewConversation.
   *  b) Containing site wants to load Bot and start conversation at load time.
   *     loadUI() displays Bot at component load time. BotConfig can come from
   *     propBotConfig or remote.
   *     Args:
   *       propBotConfig: BotConfig object
   *       propGetConfigFromRemote: false
   *       waitForStartNewConversation: false
   *  c) NOT IMPLEMENTED: Containing site wants to load Bot and get botConfig from remote then
   *     start conversation. getConfigFromRemote should be true and a remote
   *     URL provided to Bot via a prop. NOT IMPLEMENTED YET. loadUI() displays
   *     Bot at start of conversation after remote fetch. Show spinner during
   *     remote fetch. TODO: change getConfigFromRemote into null | URL so
   *     caller can pass in as a prop to getBotConfig()
   *     Args:
   *      propBotConfig: null
   *      propGetConfigFromRemote: URL
   *      waitForStartNewConversation: false | true. If true startNewConversation
   *      should not pass in a BotConfig.
   *
   */
  async function loadConfigAndConversation(
    propBotConfig,
    localStorageKey,
    getConfigFromRemote,
    waitForStartNewConversation
  ) {
    try {
      const botConfig = loadBotConfig(
        propBotConfig,
        getConfigFromRemote,
        localStorageKey,
        waitForStartNewConversation
      );

      if (botConfig) {
        try {
          let conversation = loadConversation(botConfig);
          await tick();
          //setBotSettings(conversation.botSettings);
        } catch (e) {
          console.log(`loadConversation() or botSettings() error: ${e}`);
          UIError = e;
          showUnfriendlyError = true;
        }
      } else if (!waitForStartNewConversation) {
        // no BotConfig and we are NOT waiting on caller to call
        // startNewConversation and pass in a BotConfig, so show error in UI. 
        // This generally shouldn't happen if no bugs and caller passed in all
        // the required props.
        throw new invalidBotConfig(`getBotConfig() failed to acquire a botConfig from localStorage
          and remote and waitForStartNewConversation prop was false`);
      }

    } catch (e) {
      console.log(`botconfig load error: ${e}`);
      UIError = e;
      showUnfriendlyError = true;
    } 
    // if we get here there is no botConfig, and waitForStartNewConversation
    // is true, so the if block in the html below should show nothing.
  }

  /* showBotUI() => null
   * Adds the id="bot" div to the "pageSupportBotTemplate" template. Ensures
   * style encapsulation to protect Bot from the parent site's global styles
   * Must run after bot DOM has been loaded
   */
  function showBotUI() {
    // Show the conversation in the view. Will be true if botConfig and conversation
    // successfully loaded, false otherwise. If false usually an error condition
    // like botConfig failed to load OR waitForStartNewConversation is true so 
    // we only want to show UI if getBotConfig() loaded from localStorage.
    if (waitForStartNewConversation) return null;
    // Attach bot to div#botShadowRoot
    const root = document.getElementById("botShadowRoot");
    const child = document.getElementById("botShadowChild");
    const shadow = root.attachShadow({mode: 'open'});
    shadow.appendChild(child);
    // remove "hidden" to make it visible 
    child.hidden = false;

  }



  /* loadBotConfig() => botConfig || null
   * Acquire a botConfig from wherever it can be found:
   * Args:
   *   botConfig: OPTIONAL: instance of botConfig, could be passed in from prop
   *     or startNewConversation(botConfig). Might be null.
   *   getConfigFromRemote: REQUIRED: bool: if true allows getting config from remote
   *     if not present in localStorage.
   *   localStorageKey: REQUIRED: key used to save botConfig to localStorage
   * Order of operation:
   *   1. if botConfig arg is present, use that and save to localStorage
   *   2. if botConfig arg not present and getConfigFromRemote is false, check
   *      localStorage and use that.  If not present in localStorage, error.
   *   3. if botConfig arg not present and getConfigFromRemote is true and
   *      not present in localStorage, go to remote. 
   * 
   *  Note that the caller of this function is responsible for raising errors
   *  if botConfig acquisition fails.
   */
  function loadBotConfig(
    botConfig,
    getConfigFromRemote,
    localStorageKey,
    waitForStartNewConversation
  ) {
    if (botConfig && versionCompatible(botConfig.version)) {
      saveBotState(botConfig, localStorageKey); // given new botConfig so save to localStorage
      currentFrame = botConfig.startFrameId;
      return botConfig;
    } else {
      // show loading UI only if caller is ok with UI showing
      if (!waitForStartNewConversation) showLoadingWaitUI = true;
      // get BotConfig from localStorage or remote if getConfigFromRemote is true
      botConfig = getBotConfig(false, 
                               getConfigFromRemote, 
                               localStorageKey, 
                               waitForStartNewConversation);
      showLoadingWaitUI = false;
      if (botConfig) { 
        currentFrame = botConfig.startFrameId;
        return botConfig;
      }
    }
    // if we get here, all routes to getting botConfig have failed - caller
    // should raise error dependending on scenario.
    return null;
  }

  /* loadConversation() => conversation object || null
   * Called when the website Bot is embedded in does a page load.
   * Populates view variables like completedRounds and accepted replies so the UI
   * can present the next slot. Uses existing conversation state. May start a
   * new conversation or resume existing one if none is in progress.
   *
   * Args:
   *   - botConfig: REQUIRED: instance of botConfig
   *   - getConfigFromRemote: REQUIRED: bool. if true, initConversation call here will
   *     try to get botConfig from remote if it doesn't find one in localStorage.
   *     See scenarios at top of this file for what to set to.
   *
   * Returns conversation object - mostly to enable setBotSettings() and
   * populates state in browser's localstorage and populates
   * UI variables to display.
   *
   */
  function loadConversation(botConfig) {
    if (!botConfig) {
      console.log(
        `Error calling loadConversation(): botConfig arg must be supplied`
      );
    } else {
      // get conversation from sessionStorage or if not present, by
      // creating a new conversation. Preserves existing conversation
      // across page loads.
      let conversation =
        getConversation(localStorageKey) ||
        initConversation(botConfig, currentFrame, localStorageKey);
      if (conversation) {
        frameIntroduction = conversation.introduction;
        localeString = conversation.localeString;
        populateConversationUI(); // set view variables
        return conversation;
      } else {
        console.log("failed to load conversation in loadConversation()");
        return null;
      }
    }
  }

  // After any DOM update (usually triggered by a variable here being updated
  // for instance the bot renders a say, run the listed functions.
  afterUpdate(() => {
    styleListItemsWithImages(); // apply non-default style to rendered markdown
  });


  /* setBotSettings() => undefined
     Arg: REQUIRED instance of botSettings object.
     Sets client bot look and feel based on BotConfig. To test in storybook
     select the story, click restart, then refresh the browser.  fontFamily
     is applied to the whole botContainer element and all its children including
     buttons, bot and user generated text. Must be called after the DOM is in 
     place, ie. in an onMount async function. This is done in a js function 
     to enable botConfig file to set cosmetics.
   */
  function setBotSettings(botSettings = {}) {
    const el = document.getElementById("botContainer");
    el.style.setProperty("--primary-color", botSettings.primaryColor);
    el.style.setProperty("--secondary-color", botSettings.secondaryColor);
    el.style.setProperty("--hover-color", botSettings.hoverColor);
    el.style.setProperty("--container-color", botSettings.containerBg);
    el.style.setProperty(
      "--container-border-color",
      botSettings.containerBorderBg
    );
    el.style.fontFamily = botSettings.customerFont;
  }

  /* styleListItemsWithImages() => undefined
   * Remove styles (and therefore the bullets) from list items coming from
   * the marked render.
   * Enables users to render pretty images at top of each list item
   * and display them like product or topic cards.
   * Do this if the first element in the li is an
   * img, otherwise do nothing. Only select li elements that are children
   * of ul elements - we don't want to do this to <ol> diagnostic items -
   * seeing the numbering is useful as subsequent steps in history may refer back
   * to earlier ones. Must run after DOM updates. No return value.
   */
  function styleListItemsWithImages() {
    // Apply mt-12 to all the li elements if they have an image at top
    let selector = `#conversationHistory ul > li img:first-child, 
                    #currentAsk ul > li img:first-child`;
    const imgs = document.querySelectorAll(selector);

    if (imgs.length > 0) {
      // If images appear as first children in a list item,
      // add margin-top and remove bullets
      imgs.forEach((img) => (img.style.marginTop = "3rem"));
      // Apply list-none up chain from img => li => ul elements that contain
      // those images
      imgs.forEach((img) => {
        img.parentElement.parentElement.style.listStyleType = "none";
      });
    }
  }

  /* startNewConversation(bot) => undefined
   * Start a new conversation from the beginning, stopping one if its running.
   * Populates all the needed view variables to display a conversation.
   *
   * Args: newBot : OPTIONAL is an instance of the botConfig object.
   *
   * Behavior WRT botConfig sourcing:
   *   1. use newBot if argument present.
   *   2. use propBotConfig if newBot === null (passed in from prop)
   *   3. try to get botConfig from localStorage
   *   4. try fetching botConfig from remote
   *   5. raise error if all that fails.
   */
  async function startNewConversation(newBot = null) {
    try {
      let botConf = loadBotConfig(
        newBot || propBotConfig,
        propGetConfigFromRemote,
        localStorageKey,
        waitForStartNewConversation
      );

      if (!botConf) {
        throw new invalidBotConfig(`startNewConversation() failed to acquire a botConfig from localStorage and remote.`);
      }

      let conversation = initConversation(botConf, currentFrame, localStorageKey);

      if (conversation) {
        localeString = conversation.localeString;
        frameIntroduction = conversation.introduction;
        populateConversationUI(); // set view variables
        showBotUI();
        await tick(); // wait for ui to show in DOM
        // set custom color and font properties in case user changed them in publisher mode
        setBotSettings(conversation.botSettings);
      } else {
        throw new invalidBotConfig(`startNewConversation() failed to acquire conversation objectfrom initConversation()`);
      }

    } catch (e) {
      console.log(`startNewConversation() botconfig error: ${e}`);
      UIError = e;
      showUnfriendlyError = true;
    }
    
  }

  
</script>
HI
<div id="botShadowRoot" ></div>






