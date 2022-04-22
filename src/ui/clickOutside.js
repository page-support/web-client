/** 
 * Dispatch event on click outside of the DOM element in the argument.
 * Imported into any component that needs to open/close
 * a modal, select box or other ui element when the user clicks
 * outside of it
 * Args: node is the html node we want to detect clicks outside of
 * Derived from https://svelte.dev/repl/0ace7a508bd843b798ae599940a91783?version=3.16.7
 **/
export function clickOutside(node) {
  
  const handleClick = event => {
    if (node && !node.contains(event.target) && !event.defaultPrevented) {
      node.dispatchEvent(
        new CustomEvent('click_outside', node)
      )
    }
  }

  // To select el in the shadowRoot must select off the shadowRoot not document
  const shadowRt = document.querySelector('#botShadowHost').shadowRoot;
	shadowRt.getElementById("pageBotContainer").addEventListener('click', handleClick, true);
  
  return {
    destroy() {
      shadowRt.getElementById("pageBotContainer").removeEventListener('click', handleClick, true);
    }
	}
}