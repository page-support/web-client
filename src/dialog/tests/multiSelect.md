<!-- query: internet is down -->

<!-- [phrasing] 
* my router doesn't work
* my internet is down
-->

<!-- 
say.name: device
say.ask: what type of device do you have?
say.type: single
reply.name: deviceType
[reply.values]
* model A1 router
* model B334 router
-->


<!--
say.name: attempts
say.ask: Select which of the following solutions you have already tried.
say.type: multiple 
say.trigger: same('device',[1])
reply.name: allAttempts
[reply.values]
* Rebooted my computer
* Reconnected to WiFi
* Rebooted the router
* Reinstalled my OS
* Updated router firmware
* Checked that router power is on and cables are connected.
* Switched Wifi to 5G
-->

<!-- 
say.trigger: same('device',[0]) 
say.type: answer
-->
Your router may need to be upgraded, this router has a history of problems and doesn't support some new devices. We suggest one of the following routers - click the link to purchase:
- [InternetCo Router WB45](http://www.example.com)
- [InternetCo Router XY87](http://www.example.com) 
- [FancyWidgetCo Router WFFB45](http://www.example.com)


<!-- 
say.trigger: same('device',[1]) and (subset('attempts', [0, 1, 2])) 
say.type: answer
-->
Your router is not connected to our servers. Try the following in this precise order:
1. unplug your router's power
2. unplug your router cable
3. disconnect all devices
4. do a handstand
5. reconnect the power
6. reconnect the cable
7. reconect your devices  

<!-- 
say.type: answer
say.name: giveUp
say.type: answer
-->
Please check our community forums for more information on what your problem might be.





