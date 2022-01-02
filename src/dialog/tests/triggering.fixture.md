<!-- query: test triggers -->
# Lorem IpsumLorem IpsumLorem IpsumLorem IpsumLorem Ipsum

<!-- [phrasing] 
* Lorem IpsumLorem Ipsum
-->

<!-- 
say.name: AskOne
say.ask: Ask one
say.type: single
reply.name: blahType 
[reply.values]
* blah 1
* blah 2
-->

<!-- 
say.name: AskTwo
say.ask: Ask Two
say.type: single
reply.name: productType
[reply.values]
* one
* two
-->

<!--
say.name: selectCountries
say.ask: Ask three
say.type: multiple 
reply.name: allOptions
[reply.values]
* option 1
* option 2
* option 3
* option 4
-->

<!-- 
say.trigger: same('AskOne',[0]) and same('AskTwo', [0]) and (share('selectCountries', [1]) and not (share('selectCountries', [2,3])))
say.type: answer
-->
first answer

<!-- 
say.trigger: (share('selectCountries', [2,3]) or same('AskOne', [1])) and same('AskTwo', [0])
say.type: answer
-->
second to last answer

<!-- 
say.trigger: same('AskTwo', [1]) 
say.type: answer
-->
Last answer



