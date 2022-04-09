<script>
/* BotConversationUI.svelte
 * This svelte component is reponsible for rendering the conversation UI, based
 * on the conversation data loaded by Bot.svelte. Bot.svelte is also responsible
 * for attaching this module to a shadowRoot to isolate this module's styles
 * from sites that bot is added to.
 */

// props passed in from Bot.svelte which owns loading conversation data
export let frameIntroduction;
export let completedRounds;
export let replyType;
export let replyOptions;
export let showUnfriendlyError;
export let waitForStartNewConversation;
export let showLoadingWaitUI;

import { getNextSlot } from "../dialog/dialog.js"; // Returns a Round object
import { saveReply } from "../dialog/dialog.js";

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


<div id="botShadowChild">

  {#if !showUnfriendlyError }
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
  
  </div>


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