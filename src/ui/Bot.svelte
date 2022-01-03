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

  
  import { getNextSlot } from "../dialog/dialog.js"; // Returns a Round object
  import { initConversation, rewindConversation } from "../dialog/dialog.js";
  import {
    getConversation,
    getBotConfig,
    saveBotState,
    versionCompatible,
    invalidBotConfig
  } from "../state/state.js";
  import { saveReply } from "../dialog/dialog.js";
  import { ENDINGS } from "../dialog/dialog.js";
  import { BUILT_IN_REPLIES } from "../state/BuiltInReplies.js";
  import { dropLast } from "ramda";
  import Marked from "../../node_modules/marked/lib/marked.esm.js";
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


  // Show the conversation in the view. Will be true if botConfig and conversation
  // successfully loaded, false otherwise. If false usually an error condition
  // like botConfig failed to load OR waitForStartNewConversation is true so 
  // we only want to show UI if getBotConfig() loaded from localStorage.
  let showBotUI = waitForStartNewConversation ? false : true;

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

  // Responsible for all GUI loading scenarios in this component
  loadUI(
    propBotConfig,
    localStorageKey,
    propGetConfigFromRemote,
    waitForStartNewConversation
  );

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
  async function loadUI(
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
        let conversation = loadConversation(botConfig);
        showBotUI = true;
        await tick();
        // setBotCosmetics requires the DOM in place and the conversation
        // object to set custom color and font properties
        setBotCosmetics(conversation.botCosmetics);
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
   * Returns conversation object - mostly to enable setBotCosmetics() and
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
        showBotUI = true; // false by default
        return conversation;
      } else {
        console.log("failed to load conversation in loadConversation()");
        showBotUI = false;
        return null;
      }
    }
  }

  // After any DOM update (usually triggered by a variable here being updated
  // for instance the bot renders a say, run the listed functions.
  afterUpdate(() => {
    styleListItemsWithImages(); // apply non-default style to rendered markdown
  });

  /* setBotCosmetics() => undefined
     Arg: REQUIRED instance of botCosmetics object.
     Sets client bot look and feel based on BotConfig. To test in storybook
     select the story, click restart, then refresh the browser.  fontFamily
     is applied to the whole botContainer element and all its children including
     buttons, bot and user generated text. Must be called after the DOM is in 
     place, ie. in an onMount async function. This is done in a js function 
     to enable botConfig file to set cosmetics.
   */
  function setBotCosmetics(botCosmetics = {}) {
    const el = document.getElementById("botContainer");
    el.style.setProperty("--primary-color", botCosmetics.primaryColor);
    el.style.setProperty("--secondary-color", botCosmetics.secondaryColor);
    el.style.setProperty("--hover-color", botCosmetics.hoverColor);
    el.style.setProperty("--container-color", botCosmetics.containerBg);
    el.style.setProperty(
      "--container-border-color",
      botCosmetics.containerBorderBg
    );
    el.style.fontFamily = botCosmetics.customerFont;
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
        showBotUI = true;
        await tick(); // wait for ui to show in DOM
        // set custom color and font properties in case user changed them in publisher mode
        setBotCosmetics(conversation.botCosmetics);
      } else {
        throw new invalidBotConfig(`startNewConversation() failed to acquire conversation objectfrom initConversation()`);
      }

    } catch (e) {
      console.log(`startNewConversation() botconfig error: ${e}`);
      UIError = e;
      showUnfriendlyError = true;
    }
    
  }

  /* populateConversationUI() => undefined
   * Populates UI variables needed to display a conversation:
   *  completedRounds, replyType, replyOptions
   */
  function populateConversationUI() {
    // empty the input box and error for free text entry in case reused
    userText = "";
    inputError = "";

    ({ completedRounds, replyType, replyOptions } =
      getNextSlot(localStorageKey));
  }

  /***************** DOM EVENT handlers ***************/

  /* Handle user clicking button on a single reply ask */
  function singleReplyClick(userReplyStr, userReplyIndex) {
    saveReply({
      userReplyValues: [userReplyStr],
      userReplyIndexes: [userReplyIndex],
      ending: ENDINGS.completed,
      stats: {},
      localStorageKey: localStorageKey,
    });

    populateConversationUI(); // get next slot and update UI variables.
  }

  /* multiReplySubmit() => undefined
   * Handle user clicking 'done' on a multiple reply ask. The
   * argument will have an array of integers representing the replies
   * the user selected.
   * Args: REQUIRED: event :event from UI
   * See https://svelte.dev/tutorial/component-events for format
   */
  function multiReplySubmit(event) {
    const userReplyValues = event.detail.map((i) => replyOptions[i]);
    saveReply({
      userReplyValues: userReplyValues,
      userReplyIndexes: event.detail,
      ending: ENDINGS.completed,
      stats: {},
      localStorageKey: localStorageKey,
    });

    populateConversationUI(); // get next slot and update the UI.
  }

  function userReplyError(message) {
    this.name = "Oops, ";
    this.message = message;
    this.stack = new Error().stack;
  }
  userReplyError.prototype = new Error();

  /* editUserReply(rewoundRoundIndex: int) => undefined
   * When user clicks edit on a previously answered slot/round and saves it
   * this function is called to reset conversation history. It removes rounds
   * after this one and recomputes the next round, updating the view
   * accordingly. This implementation is simpler than updating the view after
   * the user answers the slot, because we can use the existing view code to
   * re-render the view reactively.  If we want to change the view update to after
   * the user answers the slot, we need new code and more componentization to
   * render the slot before the view updates.
   * Args:
   *   REQUIRED: rewoundRoundIndex is the index into completedRounds where the user is
   *   editing their answer.
   */
  function editUserReply(rewoundRoundIndex) {
    // modify conversation history to drop all userReplies after and
    // including this one
    rewindConversation(rewoundRoundIndex, false, localStorageKey);

    populateConversationUI(); // setup view for next slot
  }

  /* Placeholder for future free text entry
   * handleTextInput()
   * Take the string entered by the user in freeTextReply components
   * and handle it.
   * Uses userText value which is the string entered by the user
   *
  function handleTextInput() {
    try {
      parseTextInput(userText);
    } catch (e) {
      inputError = e;
      console.log(e.stack);
    }
  }

  // handle keyup event on free text entry field for user reply
  function enterKeyOnInput(event) {
    if (event.key === "Enter") {
      handleTextInput();
    }
  }
  */

  /********** View Utilities ***********/

  // If replyOptions is the built in diagnostic 'done', don't need to offer
  // 'not done', just wait for done click since its a text UI
  function adaptRepliesToText(replyOptions) {
    if (replyOptions[0] === BUILT_IN_REPLIES.done[0]) {
      replyOptions = dropLast(1, replyOptions);
    }
    return replyOptions;
  }

  /* Placeholder for future free text entry
   * handleTextInput()
   * Take the string entered by the user in freeTextReply components
   * and handle it.
   * Uses userText value which is the string entered by the user
   */
  function handleTextInput() {
    try {
      parseTextInput(userText);
    } catch (e) {
      inputError = e;
      console.log(e.stack);
    }
  }

  // handle keyup event on free text entry field for user reply
  function enterKeyOnInput(event) {
    if (event.key === "Enter") {
      handleTextInput();
    }
  }
</script>

{#if showBotUI && !showUnfriendlyError}
  <!-- the container div will expand to the width given it, but elements 
      like selectors are sized to fixed width appropriate to small 
      mobile screens. Set max width in a div containing this one if needed, e.g.
      to fit into part of larger screen. The parent of this should be 320px
      or wider, and the w-auto will have the bordered chatbot fill the space
      and the mx-auto will center it -->
  <div
    id="botContainer"
    class="container mx-auto border 
      bg-container-color rounded p-2 sm:p-6 w-auto max-w-xl"
  >
    <div id="conversationHistory" class="flex flex-col space-y-4 mb-4">
      <!-- render the optional introduction for this frame -->
      <div id="frameIntroduction">
        {@html Marked(frameIntroduction)}
      </div>

      <!-- render conversation history NOT including latest ask -->

      {#each completedRounds.slice(0, -1) as { slot, userReplyValues }, rewoundRoundIndex}
        <div
          class="flex flex-col text-gray-400 bg-white 
                    border-solid border border-gray-200 rounded-lg p-3"
        >
          <!-- Bot output in past rounds -->
          <p id="bot-ask-text-completed" class="text-l mr-4 sm:mr-12 ">
            {@html Marked(slot.ask)}
          </p>

          <!-- User input in past rounds -->
          {#if userReplyValues.length > 0}
            <div id="user-reply-buttons-completed" class="mt-2">
              <p
                class="mx-4 border-b-2 border-gray-300 text-base inline-block
                      hover:text-gray-800"
                on:click={() => editUserReply(rewoundRoundIndex)}
              >
                {userReplyValues.join(", ")}

                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="inline-block ml-3 h-5 w-5 text-gray-400 hover:text-gray-800"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
                  />
                </svg>
              </p>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- render latest/current bot ask that doesnt have an user reply yet -->

    <div
      id="currentRound"
      class="sm:space-y-5 bg-white 
        border-solid border border-gray-200 rounded-lg p-3"
    >
      <!-- Bot's md text rendered to html -->
      <div id="currentAsk" class="mr-4 sm:mr-12">
        <p class="text-l">
          {@html Marked(completedRounds[completedRounds.length - 1].slot.ask)}
        </p>
      </div>

      <div id="currentUserReply">
        <div id="user-reply-div" class="sm:ml-6 mt-2">
          {#if replyType === slotTypeEnum.diagnostic || (replyType === slotTypeEnum.single && replyOptions[0] === BUILT_IN_REPLIES.done[0])}
            <div class="sm:flex sm:items-center">
              <div class="w-full sm:max-w-xs">
                {#each adaptRepliesToText(replyOptions) as userReplyValue, userReplyIndex}
                  <!-- Done button without a selector -->
                  <button
                    type="button"
                    class="w-full inline-flex items-center justify-center 
                  px-4 py-2 border 
                  border-transparent font-medium rounded-md 
                  sm:w-auto sm:text-sm
                  shadow-sm text-white bg-primary-color 
                  hover:bg-hover-color focus:outline-none focus:ring-2 
                  focus:ring-offset-2 focus:ring-hover-color"
                    id="reply-{userReplyIndex}"
                    on:click={() =>
                      singleReplyClick(userReplyValue, userReplyIndex)}
                  >
                    {userReplyValue}
                  </button>
                {/each}
              </div>
            </div>
          {:else if replyType === slotTypeEnum.single}
            <div class="sm:flex sm:items-center">
              <div class="w-full sm:max-w-xs">
                <!-- reply button with a single selector -->
                <select
                  bind:value={selectedReplyIndex}
                  class="block w-full pl-2 pr-10 text-base font-medium
                      border-gray-300 focus:outline-none focus:ring-primary-color 
                        sm:text-sm rounded-md"
                >
                  {#each replyOptions as userReplyValue, userReplyIndex}
                    <option value={userReplyIndex}>{userReplyValue}</option>
                  {/each}
                </select>
              </div>
              <button
                on:click={() =>
                  singleReplyClick(
                    replyOptions[selectedReplyIndex],
                    selectedReplyIndex
                  )}
                type="button"
                class="mt-3 w-full inline-flex items-center justify-center 
                            px-4 py-2 border 
                            border-transparent font-medium rounded-md 
                            sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm
                            shadow-sm text-white bg-primary-color
                            hover:bg-hover-color focus:outline-none focus:ring-2 
                            focus:ring-offset-2 focus:ring-hover-color"
              >
                Done
              </button>
            </div>
          {:else if replyType === slotTypeEnum.multiple}
            <MultiSelect on:message={multiReplySubmit} {replyOptions} />
          {:else if replyType === "freeTextEntry"}
            <!-- unused now, keep for free text entry sent to backend such as
                getting user's address or a search field -->
            <div class="my-2">
              <input
                bind:value={userText}
                type="text"
                size="50"
                on:keyup={(e) => enterKeyOnInput(e)}
              />

              <button on:click={handleTextInput}>Go</button>
              <span class="askIcon" on:click={() => (showReplyOptions = true)}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                    clip-rule="evenodd"
                  />
                </svg>
              </span>
              <p>{inputError}</p>
            </div>
          {:else if replyType === slotTypeEnum.endConversation}
            <p class="my-2">End of conversation</p>
          {:else if replyType !== "answer"}
            <!-- answer replies don't have a replytype, so we show nothing for them.
                if we get to this condition and the replyType isn't answer there's
                a problem because there are no other replyTypes -->
            <p class="my-2">
              Error: unsupported reply type of {replyType} received
            </p>
          {/if}
        </div>
      </div>
    </div>
    <!-- end currentRound -->

    {#if showRestartButton}
      <hr class="mt-4" />
      <!-- restart is for testing, may not be needed in actual product -->
      <div>
        <!-- <button class="text-gray-300" on:click="{() => startNewConversation()}">
          Storybook context only restart
        </button> -->
      </div>
    {/if}
  </div>
{:else if showUnfriendlyError}
  <h2 class="text-gray text-lg">Bot failed to load: {UIError}</h2>
{:else if waitForStartNewConversation}
  <!-- show nothing: used when waiting for calling site to use startNewConversation() -->
{:else if showLoadingWaitUI}
  <button type="button" class="bg-primary-600" disabled>
    <svg class="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
      <!-- ... -->
    </svg>
    Loading
  </button>
{:else}
  <h2>Unknown error</h2>
{/if}

<style global lang="postcss">
  /* Note Tailwind preprocessor works by including only styles that are 
   * present in *.svelte files in the build. For that to work at all, in
   * both Tailwind jit dev mode, and in production, this style tag must
   * include all the Tailwind class names that the user might use. If you 
   * need first transform static content like md, see 
   * https://tailwindcss.com/docs/optimizing-for-production#transforming-content
   * Note this doesn't work for user-entered markup in Publisher because
   * the build system doesn't know what that is at build time. But this
   * is useful if documentation is in md, because the md is available at
   * build time. 
   */

  /* Also it is important to avoid dynamically creating class strings in your 
   * templates with string concatenation,otherwise PurgeCSS won’t know to 
   * preserve those classes. 
   * See https://tailwindcss.com/docs/optimizing-for-production#writing-purgeable-html
   * this is OK because it preserves the full class name
   *   <div class="{{  error  ?  'text-red-600'  :  'text-green-600'  }}"></div>
   */

  /* The @import pulls in Bot's css into Bot component scope from a css file that
   * is made accessible by a bundler or a <link>. The string after import 
   * references the location of the css file relative to this file. Typically 
   * that is in your node_modules installed via npm if you are using a bundler. 
   * Putting Bot's css file in the containing site's global scope
   * like in publisher can mess with containing site's css if the containing site
   * is using tailwindcss. When Bot is being bundled with your site's other code
   * by a bundler like webpack or rollup
   * no additional <link> is needed because the bundler will 
   * compile the css file with the rest of your css. When you NOT using a bundler 
   * and instead adding Bot as an iife file, a <link> is needed in the head of 
   * your page to make this css file accessible to Bot. 
   */ 
  
  @import "../../dist/page-support-bot-bundle.css"; 
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  /* Anchor tags */
  #conversationHistory a,
  #currentRound a {
    color: #0e5890;
    /* text-decoration: underline; */
  }

  /* make introduction have less of a top margin since its the first thing 
   * the extra div before the id makes it more specific so wins over the below
   * my-* */
  div#frameIntroduction h1 {
    @apply mt-0.5;
  }

  div#frameIntroduction h2 {
    @apply mt-0.5;
  }

  div#frameIntroduction h3 {
    @apply mt-0.5;
  }

  #conversationHistory img,
  #currentAsk img {
    @apply object-cover rounded-lg shadow-lg my-2;
    max-width: 100%;
    height: auto;
  }

  #conversationHistory h3,
  #currentAsk h3 {
    @apply text-lg leading-6 font-medium my-1;
  }

  #conversationHistory h2,
  #currentAsk h2 {
    @apply text-xl leading-8 font-semibold my-2;
  }

  #conversationHistory h1,
  #currentAsk h1 {
    @apply text-2xl leading-10 font-bold my-2;
  }

  /* Need to set ul, ol classes to 'list-none' when the image occurs 
   * first in a list item. To get rid of it select the element, then 
   * add the class and mt-12.  Do this after the DOM updates, which means
   * after each call getNextTextReply
   */
  #conversationHistory ul,
  #currentAsk ul {
    @apply list-disc list-inside;
  }

  #conversationHistory ol,
  #currentAsk ol {
    @apply list-decimal list-inside;
  }

  /* Used in conjunction with botCosmetics const in BotConfig.js to set bot look
   * from Javascript at runtime. Note that these CSS custom property names must be 
   * the same ones used in tailwind.config.js extend section. (not the values 
   * those must be changed in BotConfig.js)
   * TODO: the defaults here are duplicated with what's in BotConfig - how to DRY? 
   */
  /* in element class notation, refer as bg-bot-primary-color, text-*, 
    * border-* or whatever shorthand Tailwind uses to indicate where
    * the class is applied.
    */
  #botContainer {
    /* these defaults are from the colors.sky palette in tailwindcss
     * https://tailwindcss.com/docs/customizing-colors#color-palette-reference
     */

    /* used in actionable button backgrounds */
    --primary-color: #38bdf8;
    /* used for conversation history buttons and other non-actionable elements */
    --secondary-color: #e0f2fe;
    /* used in action button hover and focus:ring - a shade darker than primary */
    --hover-color: #0ea5e9;
    /* background of the whole bot container */
    --container-color: #f9fafb;
    /* border of the whole bot container */
    --container-border-color: #f0f9ff;
  }
</style>
