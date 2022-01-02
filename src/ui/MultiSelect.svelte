<!-- 
  MultiSelect.svelte

  This Svelte component displays a list of options the user can select 
  one or more options from.

  Import into your code:

    import MultiSelect from "./MultiSelect.svelte";

  Add to your html:

    <MultiSelect on:message={multiReplySubmit} {replyOptions} />

  See the export comments below for props and Bot.svelte for 
  example usage.

-->

<script>

  import { createEventDispatcher } from "svelte";
  import { clickOutside } from "./clickOutside.js";

  const dispatch = createEventDispatcher();

  // to show in the upper list of selected replies.
  export let selectedReplyIndexes = [];

  // Array of strings user can select from that comes from Bot.svelte
  export let replyOptions;

  // UI toggles
  let showOptions = false; // Boolean: show/hide replyOptions: open == true,

  // used to track which replyOptions have already been selected so the whole
  // list of replyOptions can highlight the selected ones.
  const replyObjects = replyOptions.map((replyValue, index) => {
    return { value: replyValue, selected: false };
  });


  /* Called when user clicks on a replyOption in the lower list of replyOptions.
   * Args: index is the index into replyOptions the user selected
   * Uses replyObjects array to record whether each option is selected or not.
   * Note that select also removes a reply if it had been previously selected.
   */
  function select(index) {
    // populate array and trigger reactive display of selected replies

    if (!replyObjects[index].selected) {
      // If not previously selected, select it.

      // Add the item to the upper list of selected items.
      selectedReplyIndexes.push(index);
      selectedReplyIndexes = selectedReplyIndexes; // trigger reactivity
      // Set the left border color in the replyObjects lower list so user can
      // see what's already selected
      replyObjects[index].selected = true;
      replyObjects = replyObjects;
    } else {
      remove(index);
    }
  }


  /* Called when the x is clicked in the upper list of previously selected
   * replies.
   * Args: index is the index into replyOptions and replyObjects
   */
  function remove(index) {
    // Remove the item from the upper list of selected items
    selectedReplyIndexes.splice(selectedReplyIndexes.indexOf(index), 1);
    selectedReplyIndexes = selectedReplyIndexes; // trigger reactivity
    // Remove the left border color in the replyObjects lower list
    replyObjects[index].selected = false;
    replyObjects = replyObjects;

    console.log(`removed ${index}`);
    console.log(selectedReplyIndexes.length);
  }

  /* User clicks Save/done button next to single or multi select */
  function submit() {
    dispatch("message", selectedReplyIndexes);
  }


  /* Close multiselect options list when user clicks outside of the list */
  function handleClickOutside(event) {
    showOptions = false; // hide the options list
  }

</script>


<!-- div contains selected box, save button, and options list-->
<div class="mt-1 relative sm:max-w-xs flex flex-col"
     use:clickOutside
     on:click_outside={handleClickOutside}
  >

  {#if showOptions}
  <!-- options list toggled by open/close buttons.  -->
  <ul
    class="mb-1 w-full bg-white shadow-lg max-h-60 rounded-md 
      py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto 
      focus:outline-none sm:text-sm"
    tabindex="-1"
    role="listbox"
    aria-labelledby="listbox-label"
    aria-activedescendant="listbox-option-3"
  >
    {#each replyObjects as replyObj, index}
      <!-- Select option, manage highlight styles based on 
          mouseenter/mouseleave and keyboard navigation. Highlighted: 
          "text-white bg-gray-600", Not Highlighted: "text-gray-900" -->
      <li
        class="text-gray-900 cursor-default select-none relative py-2 pl-8 
          pr-4"
        id="listbox-option-0"
        role="option"
        on:mouseenter={() => (replyObj.highlighted = true)}
        on:mouseleave={() => (replyObj.highlighted = false)}
        class:highlightedOption={replyObj.highlighted === true}
        on:click={() => select(index)}
      >
        <!-- Selected: "font-semibold", Not Selected: "font-normal" -->
        <span
          class="font-normal block truncate"
          class:font-semibold={replyObj.selected}
        >
          {replyObj.value}
        </span>

        <!-- Highlighted: "text-white", Not Highlighted: "text-gray-600"-->
        <span
          class="text-gray-600 absolute inset-y-0 left-0 flex items-center pl-1.5"
          class:text-white={replyObj.highlighted === true}
        >
          {#if replyObj.selected}
            <!-- Checkmark Heroicon name: solid/check: only display for selected option -->
            <svg
              class="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          {/if}
        </span>
      </li>
    {/each}
  </ul>
  
{/if}

  <button
    type="button"
    class=" w-full bg-white border border-gray-300 rounded-md 
    shadow-sm pr-10 py-2 text-left cursor-default focus:outline-none 
    focus:ring-1 focus:ring-primary-color focus:border-gray-500 sm:text-sm"
    aria-haspopup="listbox"
    aria-expanded="true"
    aria-labelledby="listbox-label"
    on:click="{() => showOptions = !showOptions}" 
  >
    <!-- show box with selected options -->
    <ul
      class="bg-white max-h-60 
      py-0 text-base overflow-auto 
      focus:outline-none sm:text-sm"
      tabindex="-1"
      role="listbox"
      aria-labelledby="listbox-label"
      aria-activedescendant="listbox-option-3"
    >
      {#each selectedReplyIndexes as selectedReplyIndex}
        <li
          class="text-gray-900 cursor-default block select-none relative py-1 pl-8 
          pr-4"
          id="listbox-option-0"
          role="option"
        >
          <!-- Selected: "font-semibold", Not Selected: "font-normal" -->
          <span class="font-normal block truncate">
            {replyOptions[selectedReplyIndex]}
          </span>

          <!-- X to remove selected option -->
          <span
            class="text-gray-600 absolute inset-y-0 left-0 flex items-center 
            pl-1.5"
            on:click={() => remove(selectedReplyIndex)}
          >
            <svg
              class="fill-current h-6 w-6 "
              role="button"
              viewBox="0 0 20 20"
            >
              <path
                d="M14.348,14.849c-0.469,0.469-1.229,0.469-1.697,0L10,11.819l-2.651,3.029c-0.469,0.469-1.229,0.469-1.697,0
                                           c-0.469-0.469-0.469-1.229,0-1.697l2.758-3.15L5.651,6.849c-0.469-0.469-0.469-1.228,0-1.697s1.228-0.469,1.697,0L10,8.183
                                           l2.651-3.031c0.469-0.469,1.228-0.469,1.697,0s0.469,1.229,0,1.697l-2.758,3.152l2.758,3.15
                                           C14.817,13.62,14.817,14.38,14.348,14.849z"
              />
            </svg>
          </span>
        </li>
      {/each}
    </ul>

    <!-- if nothing selected, show empty selected options box -->
    {#if selectedReplyIndexes.length === 0}
      <div class="flex-1 text-gray-800 h-full w-full p-1 px-2 pl-3">
        Select one or more options
      </div>
    {/if}

    <!-- open/close selected items list with up/down facing angles -->
    {#if !showOptions && selectedReplyIndexes.length === 0 }
    <span
      class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none"
    >
      <!-- Heroicon name: solid/selector -->
      <svg
        class="h-5 w-5 text-gray-400"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
    </span>
    {/if}
  </button>

  <!-- button that submits the selections is only visible if there are 
     selections -->
  {#if selectedReplyIndexes.length !== 0}
    <button
      on:click={submit}
      class="mt-3 w-full inline-flex items-center justify-center px-4 py-2
        border border-transparent shadow-sm font-medium rounded-md
        text-white bg-primary-color hover:bg-hover-color focus:outline-none
        focus:ring-2 focus:ring-offset-2 focus:ring-primary-color"
    >
      Done
    </button>
  {/if}

  
</div>

<style lang="postcss" >
  
  .highlightedOption {
    @apply text-white bg-primary-color;
  }
</style>
