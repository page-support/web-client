<script>
  /* BotConversationUI.svelte
   * This svelte component is reponsible for rendering the conversation UI, based
   * on the conversation data loaded by Bot.svelte. Bot.svelte is also responsible
   * for attaching this module to a shadowRoot to isolate this module's styles
   * from sites that bot is added to.
   */

  export { startNewConversation };

  /* props and functions passed in from Bot.svelte. See comments there for background. */
  // these four are passed in from Bot.svelte - see it for explanation.

  // Prop: OPTIONAL: Boolean true if this component should display nothing until
  // startNewConversation() is called. This allows <Bot> to be added to the DOM
  // and a binding to <Bot> be avaliable to caller so it can be used. Without
  // this option you get into a catch-22 where the component can't be rendered
  // because it lacks a BotConfig, but component has to be rendered for the
  // loading code to get a binding to the component to call startNewConversation.
  export let waitForStartNewConversation = false;

  // See Bot.svelte for info on these props
  export let propBotConfig;
  export let getConfigFromRemote = false;
  export let localStorageKey;
  export let botShadowHostId;

  // show errors in the Bot UI, set to false to only log with console.error
  export let showUnfriendlyError = true;

  // See https://svelte.dev/tutorial/bind-this for usage examples
  export { init };

  /******** module scoped variables *******/

  import { getNextSlot } from "../dialog/dialog.js"; // Returns a Round object
  import {
    saveReply,
    initConversation,
    rewindConversation,
  } from "../dialog/dialog.js";
  import {
    getConversation,
    getBotConfig,
    saveBotState,
    versionCompatible,
    invalidBotConfig,
  } from "../state/state.js";
  import { ENDINGS } from "../dialog/dialog.js";
  import { BUILT_IN_REPLIES } from "../state/BuiltInReplies.js";
  import { dropLast } from "ramda";
  import { marked } from "marked";
  import { slotTypeEnum } from "../state/BotConfig.js";
  import MultiSelect from "./MultiSelect.svelte";
  import { afterUpdate, tick, onMount } from "svelte";

  /*********** Variables used in UI ***********/

  let localeString; // String: unicode locale string used for language specific sorting
  let completedRounds; // Object: populates conversation history in view
  let replyOptions; // Array of Strings: replies the user can select from
  let replyType; // String: one of slotTypeEnum in BotConfig.js
  let showReplyOptions; // boolean: true diplays the replyOptionsModal, false hides
  let selectedReplyIndex; // Integer: index of reply user selected in single select
  let userText = ""; // String: free text user input
  let inputError = ""; // String: error displayed for free text user input
  // String: if present, shows intro at beginning of frame's
  // presentation, before any slots get shown.
  let frameIntroduction = "";
  let UIError = null; // error show in UI, e.g. if botConfig doesn't load or invalid
  let loadingInProgress = false;

  // UI doesn't use this directly, but not being null signals that UI can be
  // displayed in the if block
  let conversation = null;

  // Currently the page.support publisher is able to create botConfigs
  // for multiple frames. However this Bot.svelte component does
  // not support multiple frames - it lacks a way to for the user to
  // transition from one frame to another. So at UI load time we
  // need to set currentFrame to the first frame in botConfig so it knows 
  // which frame to execute. Frames
  // are keyed with a UUID assigned by the publisher, so botConfig has
  // a startFrameId property to tell us where to start. currentFrame is
  // set at botConfig load time in loadBotConfig();
  let currentFrame = null;

  /********* Constants ******************/

  
  


  /*********** Lifecycle functions ************/

  // init() loads data needed to render UI. Only call this if we are ready to
  // fetch a botConfig and start a conversation. So if waitForStartNewConversation
  // is true, don't call it. The parent site will call startNewConversation()
  // in Bot, which will call init()
  if (!waitForStartNewConversation) init(propBotConfig, false);

  /* Initialize the UI and its variables. First it loads botConfig, then
   * the conversation object, then the UI.
   * Called in two scenarios:
   *   1. when this component is loaded into DOM, in which case it tries to
   *      acquire a botConfig from localStorage or remote.
   *   2. by startNewConversation() which is triggered by the parent site. In
   *      this case, a botConfig MAY be passed in - if so use it, if not try
   *      to acquire from localStorage or remote as in 1.
   *
   */



  /*************** data loading functions **************/

  /* init()
   * load botConfig and then conversation object so UI can be displayed
   * Args:
   *   botConfig: OPTIONAL: if not present will try to load one from remote.
   *              will error if not found on remote or in localStorage
   *   startNewConversation: OPTIONAL: if true, will start a new conversation, 
   *              even if one was ongoing. By default continues any existing 
   *              conversation (or if set to false)
   */
  async function init(botConfig = null, startNewConversation = false) {
    // if botConfig not passed in from Bot.startNewConversation calling
    // this function, then load it from the prop or remote.  throw if fails.
    console.log(`in init in BotCon..${waitForStartNewConversation}`)
    try {
      if (!botConfig) {
        // try to get from localstorage or remote
        botConfig = await loadBotConfig(
          false,
          getConfigFromRemote,
          localStorageKey
        );
      }
      
      currentFrame = botConfig.startFrameId; // set frame manually since only one now
      conversation = loadConversation(botConfig, startNewConversation);
      if (conversation) {
        await tick();
        setBotSettings(conversation.botSettings);
      } else {
        throw Error(`Failed to load conversation`);
      }
    } catch (e) {
      console.error(`Error in caught in botConversationUI.svelte init(): ${e}`);
      UIError = e;
    }
  }


  /* startNewConversation()
   * Turns off waitForStartNewConversation then runs init. Used by parent 
   * component's startNewConversation() function.
   * Args:
   *   botConfig: OPTIONAL: if not present will try to load one from remote.
   *              will error if not found on remote or in localStorage
   *   startNewConversation: OPTIONAL: if true, will start a new conversation, 
   *              even if one was ongoing. By default continues any existing 
   *              conversation (or if set to false)
   */
  function startNewConversation(botConfig = null, startNewConversation = false) {
    // set to false otherwise won't display anything due to if clause below
    waitForStartNewConversation = false;  
    init(botConfig, startNewConversation);
  }


  /* loadBotConfig() => botConfig || raises invalidBotConfig()
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
    localStorageKey
  ) {
    if (botConfig && versionCompatible(botConfig.version)) {
      saveBotState(botConfig, localStorageKey); // given new botConfig so save to localStorage
      return botConfig;
    } else {
      loadingInProgress = true; // shows loading indicator until data loaded.
      botConfig = getBotConfig(getConfigFromRemote, localStorageKey );
      loadingInProgress = false; // remove loading indicator once data loaded.
      if (botConfig) {
        return botConfig;
      }
    }
    // if we get here, all routes to getting botConfig have failed
    throw new invalidBotConfig(
      `loadBotConfig() failed to acquire a botConfig from localStorage and remote`
    );
  }

  /* loadConversation() => conversation object || null
   * Called when the website Bot is embedded in does a page load.
   * Populates view variables like completedRounds and accepted replies so the UI
   * can present the next slot. Uses existing conversation state. May start a
   * new conversation or resume existing one if none is in progress.
   *
   * Args:
   *   - botConfig: REQUIRED: instance of botConfig
   *   - startNewConversation: OPTIONAL: bool. if true, initConversation()
   *     will be run and new conversation started. If false, will try to continue
   *     existing conversation unless there is no on going conversation, in
   *     which case will start a new one. Setting to true enables Bot.svelte
   *     to offer the startNewConversation prop to let the parent site control
   *     when conversations are started.
   *
   * Returns conversation object - mostly to enable setBotSettings() and
   * populates state in browser's localstorage and populates
   * UI variables to display.
   *
   */
  function loadConversation(botConfig, startNewConversation = false) {
    if (!botConfig)
      throw new invalidBotConfig(`init() in BotConversationUI.svelte 
    didn't find a valid botConfig passed in as a prop`);
    
    let conversation;

    // getConversation() gets in progress conversation from sessionStorage or
    // if not present, create a new conversation that starts from the beginning
    // with initConversation. Preserves existing conversation across page loads.
    if (startNewConversation) {
      conversation = initConversation(botConfig, currentFrame, localStorageKey);
    } else {
      conversation =
        getConversation(localStorageKey) ||
        initConversation(botConfig, currentFrame, localStorageKey);
    }
    
    if (conversation) {
      console.log('in conversation block')
      frameIntroduction = conversation.introduction;
      localeString = conversation.localeString;
      populateConversationUI(); // set view variables
      return conversation;
    } else {
      throw new Error("failed to load conversation in loadConversation()");
    }
  }

  /* populateConversationUI() => undefined
   * Populates UI variables needed to display a conversation:
   *  completedRounds, replyType, replyOptions
   * See the newConversation constructor in dialog.js for how completedRounds
   * is structured.
   */
  function populateConversationUI() {
    // empty the input box and error for free text entry in case reused
    userText = "";
    inputError = "";

    ({ completedRounds, replyType, replyOptions } =
      getNextSlot(localStorageKey));
  }
  console.log(`replyType ${JSON.stringify(replyType, null, 2)}`);
  // After any DOM update (usually triggered by a variable here being updated
  // for instance the bot renders a say, run the listed functions.
  afterUpdate(() => {
    styleListItemsWithImages(); // apply non-default style to rendered markdown
  });

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

    const shadowRoot = document.getElementById(botShadowHostId).shadowRoot;
    const imgs = shadowRoot.querySelectorAll(selector);

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
    const shadowRoot = document.getElementById(botShadowHostId).shadowRoot;
    // shadowRoot only accessible via parent element.
    const el = shadowRoot.getElementById("botShadowTree");
    if (!el) throw Error(`setBotSettings() didn't find #botShadowTree in UI`);
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

<div id="botShadowTree">
  {#if UIError && showUnfriendlyError}
    <p style="color: red">Bot failed to load: {UIError}</p>

  {:else if loadingInProgress && !conversation}
    <button type="button" class="bg-indigo-500">
      <svg class="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <div class="text-indigo-600">Loading...</div>
    </button>

  {:else if waitForStartNewConversation}
    <!-- show nothing: used when waiting for calling site to use startNewConversation() -->

  {:else if conversation}

    <!-- the container div will expand to the width given it, but elements 
          like selectors are sized to fixed width appropriate to small 
          mobile screens. Set max width in a div containing this one if needed, e.g.
          to 66666fit into part of larger screen. The parent of this should be 320px
          or wider, and the w-auto will have the bordered chatbot fill the space
          and the mx-auto will center it -->
    <div
      id="pageBotContainer"
      class="container mx-auto border 
          bg-container-color rounded p-2 sm:p-6 w-auto max-w-xl"
    >
      <div id="conversationHistory" class="flex flex-col space-y-4 mb-4">
        <!-- render the optional introduction for this frame -->
        <div id="frameIntroduction">
          {@html marked(frameIntroduction)}
        </div>

        <!-- render conversation history NOT including latest ask -->

        {#each completedRounds.slice(0, -1) as { slot, userReplyValues }, rewoundRoundIndex}
          <div
            class="flex flex-col text-gray-400 bg-white 
                        border-solid border border-gray-200 rounded-lg p-3"
          >
            <!-- Bot output in past rounds -->
            <p id="bot-ask-text-completed" class="text-l mr-4 sm:mr-12 ">
              {@html marked(slot.ask)}
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
                    class="inline-block ml-3  text-gray-400 hover:text-gray-800"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    style="height: 18px; width: 18px;"
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
            {@html marked(completedRounds[completedRounds.length - 1].slot.ask)}
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
                <span
                  class="askIcon"
                  on:click={() => (showReplyOptions = true)}
                >
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
    </div>
  {:else}
    <p style="color: red">Unknown condition</p>
  {/if}
</div>

<!-- botShadowTree closing div -->
<style global type="text/css" lang="postcss">
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

  /* Used in conjunction with botSettings const in BotConfig.js to set bot look
     * from Javascript at runtime. Note that these CSS custom property names must be 
     * the same ones used in tailwind.config.js extend section. (not the values 
     * those must be changed in BotConfig.js)
     * TODO: the defaults here are duplicated with what's in BotConfig - how to DRY? 
     */
  /* in element class notation, refer as bg-bot-primary-color, text-*, 
      * border-* or whatever shorthand Tailwind uses to indicate where
      * the class is applied.
      */
  #pageBotContainer {
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
