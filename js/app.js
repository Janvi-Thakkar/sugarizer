
// Sugar Libraries (initialized by require)
var iconLib;
var xoPalette;
var radioButtonsGroup;
var datastore;
var preferences;
var util;


// Constants
var sizeOwner = 100;
var sizeRadius = 180.0;
var radialView = 0;
var listView = 1;
var initActivitiesURL = "activities.json";
var iconSizeList = 40;
var iconSizeFavorite = 20;
var popupMarginLeft = 15;
var popupMarginTop = 15;
var timerPopupDuration = 1000;
var maxPopupHistory = 5;


// Main app class
enyo.kind({
	name: "Sugar.Desktop",
	kind: enyo.Control,
	components: [
		{name: "owner", onclick: "changeColor", classes: "owner-icon", showing: true},
		{name: "activitybox", showing: true, components: []},
		{name: "activitylist", showing: false, kind: "Sugar.Desktop.ListView"},
		{name: "activityPopup", kind: "Sugar.Desktop.ActivityPopup", showing: false},		
		{name: "activities", kind: "enyo.WebService", url: initActivitiesURL, onResponse: "queryResponse", onError: "queryFail"}
	],
	
	// Constructor
	create: function() {
		// Init screen
		this.inherited(arguments);
		this.currentView = radialView;
		this.timer = null;
		var that = this;
		document.onmousemove = function(e) {
			that.position = {x: e.pageX, y: e.pageY};
		}

		// Get activities from local storage or from init web service
		if (preferences.getActivities() == null) {
			this.$.activities.send();
		} else {
			this.init();
			this.$.activitylist.setCount(preferences.getActivities().length);
		}
	},
	
	// Init web service response, redraw screen
	queryResponse: function(inSender, inResponse) {
		preferences.setActivities(inResponse.data);
		this.$.activitylist.setCount(preferences.getActivities().length);
		preferences.save();
		this.init();
	},
	
	// Error on init
	queryFail: function(inSender, inError) {
		console.log("Error loading init activities");
	},
	
	// Init desktop
	init: function() {
		this.draw();
	},
	
	// Draw desktop
	draw: function() {
		// Clean desktop
		var items = [];
		enyo.forEach(this.$.activitybox.getControls(), function(item) {	items.push(item); });		
		for (var i = 0 ; i < items.length ; i++) { items[i].destroy(); };
		
		// Get desktop size
		var canvas = document.getElementById("canvas");
		var canvas_height = canvas.offsetHeight;
		var canvas_width = canvas.offsetWidth;
		var canvas_centery = parseFloat(canvas_height)/2.0;
		var canvas_centerx = parseFloat(canvas_width)/2.0
		var radius = Math.min(canvas_centery,sizeRadius);
		
		// Draw XO owner
		this.$.owner.applyStyle("margin-left", (canvas_centerx-sizeOwner/4)+"px");
		this.$.owner.applyStyle("margin-top", (canvas_centery-sizeOwner/4)+"px");
		
		// Draw activity icons;	
		var activitiesList = preferences.getFavoritesActivities();
		var base_angle = ((Math.PI*2.0)/parseFloat(activitiesList.length));
		for (var i = 0 ; i < activitiesList.length ; i++) {
			var activity = activitiesList[i];
			var angle = base_angle*parseFloat(i);
			this.$.activitybox.createComponent({
					kind: "Sugar.ActivityIcon", 
					activity: activity, 
					x: canvas_centerx+Math.cos(angle)*radius, 
					y: canvas_centery+Math.sin(angle)*radius,
					colorized: activity.activityId != null,
					onclick: "runActivity",
					onmouseover: "popupShowTimer",
					onmouseout: "popupHideTimer"
				},
				{owner: this}).render();
		}
	},
	
	// Switch between radial and list view
	switchView: function() {
		this.currentView = (this.currentView + 1) % 2;
		this.$.owner.hide();
		this.$.activitybox.hide();
		this.$.activitylist.hide();
		if (this.currentView == radialView) {
			this.draw();
			this.$.activitybox.show();
			this.$.owner.show();
			this.render();
		}
		else if (this.currentView == listView)
			this.$.activitylist.show();		
	},
	
	// Render
	rendered: function() {
		this.inherited(arguments);
		iconLib.colorize(this.$.owner.hasNode(), preferences.getColor());
	},
	
	// Change color
	changeColor: function() {
		preferences.nextColor();
		this.draw();
		this.render();
	},
	
	// Run activity
	runActivity: function(icon) {
		// Save context then run the activity in the context
		preferences.runActivity(icon.activity);
	},
	
	// Popup handling
	popupShowTimer: function(icon, e) {
		if (this.timer != null) {
			this.$.activityPopup.hidePopup();
			window.clearInterval(this.timer);
		}
		this.$.activityPopup.setIcon(icon);		
		this.timer = window.setInterval(enyo.bind(this, "showPopup"), timerPopupDuration);
	},
	
	showPopup: function(icon, e) {
		this.$.activityPopup.showPopup();
		window.clearInterval(this.timer);
		this.timer = null;
	},
	
	popupHideTimer: function(icon, e) {
		if (this.timer != null) {
			window.clearInterval(this.timer);
		}
		this.$.activityPopup.setIcon(icon);	
		this.timer = window.setInterval(enyo.bind(this, "hidePopup"), timerPopupDuration);
	},

	hidePopup: function() {
		if (this.$.activityPopup.cursorIsInside(this.position))
			return;
		this.$.activityPopup.hidePopup();
		window.clearInterval(this.timer);
		this.timer = null;		
	}
});


// Listview view
enyo.kind({
	name: "Sugar.Desktop.ListView",
	kind: "Scroller",
	published: { count: 0 },	
	components: [
		{name: "activityList", classes: "activity-list", kind: "Repeater", onSetupItem: "setupItem", components: [
			{name: "item", classes: "activity-list-item", components: [
				{name: "favorite", kind: "Sugar.ActivityIcon", x: 10, y: 14, size: iconSizeFavorite, onclick: "switchFavorite",
					activity: { directory: "icons", icon: "emblem-favorite.svg" }},			
				{name: "activity", kind: "Sugar.ActivityIcon", x: 60, y: 5, size: iconSizeList},
				{name: "name", classes: "activity-name"},
				{name: "version", classes: "activity-version"}
			]}
		]}
	],
  
	// Constructor: init list
	create: function() {
		this.inherited(arguments);
		this.countChanged();
	},
	
	// Count changed
	countChanged: function() {
		this.$.activityList.setCount(this.count);
	},

	// Init setup for a line
	setupItem: function(inSender, inEvent) {
		// Set item in the template
		var activitiesList = preferences.getActivities();
		inEvent.item.$.activity.setActivity(activitiesList[inEvent.index]);
		inEvent.item.$.favorite.setColorized(activitiesList[inEvent.index].favorite);		
		inEvent.item.$.name.setContent(activitiesList[inEvent.index].name);	
		inEvent.item.$.version.setContent("Version "+activitiesList[inEvent.index].version);			
	},
	
	// Switch favorite value for clicked line
	switchFavorite: function(inSender, inEvent) {
		var activitiesList = preferences.getActivities();	
		inSender.setColorized(preferences.switchFavoriteActivity(activitiesList[inEvent.index]));
		inSender.render();
		preferences.save();
	}
});


// Popup menu of the activity
enyo.kind({
	name: "Sugar.Desktop.ActivityPopup",
	kind: "enyo.Control",
	classes: "home-activity-popup",
	published: { icon: null },
	components: [
		{classes: "popup-title", onclick: "runLastActivity", components: [
			{name: "icon", kind: "Sugar.ActivityIcon", x: 5, y: 5, size: iconSizeList},
			{name: "name", classes: "popup-name-text"},
			{name: "title", classes: "popup-title-text"},
		]},
		{name: "history", classes: "popup-history", showing: false, components: [
			{name: "historylist", kind: "Sugar.Desktop.PopupListView"}
		]},
		{name: "footer", classes: "popup-footer", showing: false, onclick: "runNewActivity", components: [
			{name: "iconbase", kind: "Sugar.ActivityIcon", x: 5, y: 8, size: iconSizeFavorite, colorized: false},
			{content: "Start new", classes: "popup-new-text"}			
		]}
	],
	
	// Constructor
	create: function() {
		this.inherited(arguments);	
		this.iconChanged();	
		this.timer = null;
	},
	
	// Property changed
	iconChanged: function() {
		if (this.icon != null) {
			this.applyStyle("margin-left", (this.icon.x+popupMarginLeft)+"px");
			this.applyStyle("margin-top", (this.icon.y+popupMarginTop)+"px");
			this.$.icon.setActivity(this.icon.activity);
			this.$.icon.setColorized(this.icon.activity.activityId != null);
			this.$.icon.render();
			this.$.name.setContent(this.icon.activity.name);
			if (this.icon.activity.activityId != null && this.icon.activity.instances[0].metadata.title !== undefined) {
				this.$.title.setContent(this.icon.activity.instances[0].metadata.title);			
			} else {
				this.$.title.setContent(this.icon.activity.name+" activity");
			}
			this.$.iconbase.setActivity(this.icon.activity);			
		}
	},
	
	// Control popup visibility
	showPopup: function() {
		this.show();
		this.timer = window.setInterval(enyo.bind(this, "showContent"), timerPopupDuration);
	},
	
	hidePopup: function() {
		this.hide();
		this.$.history.hide();
		this.$.historylist.setActivity(null);
		this.$.footer.hide();
	},
	
	showContent: function() {
		window.clearInterval(this.timer);
		this.timer = null;
		if (this.showing) {
			this.$.historylist.setActivity(this.icon.activity);	
			if (this.icon.activity.instances.length > 0)
				this.$.history.show();
			this.$.footer.show();
		}
	},
	
	// Click on the header icon, launch last activity
	runLastActivity: function() {
		preferences.runActivity(this.icon.activity);
	},
	
	// Click on the footer icon, launch new activity
	runNewActivity: function() {
		preferences.runActivity(this.icon.activity, null);
	},
	
	// Test is cursor is inside the popup
	cursorIsInside: function(position) {
		var obj = document.getElementById(this.getAttribute("id"));
		var p = {};
		p.x = obj.offsetLeft;
		p.y = obj.offsetTop;
		p.dx = obj.clientWidth;
		p.dy = obj.clientHeight;
		while (obj.offsetParent) {
			p.x = p.x + obj.offsetParent.offsetLeft;
			p.y = p.y + obj.offsetParent.offsetTop;
			if (obj == document.getElementsByTagName("body")[0]) {
				break;
			} else {
				obj = obj.offsetParent;
			}
		}
        var isInside = (position.x >= p.x && position.x <= p.x + p.dx && position.y >= p.y && position.y <= p.y + p.dy);
		return isInside;
	}
});




// Activity popup listview
enyo.kind({
	name: "Sugar.Desktop.PopupListView",
	kind: "Scroller",
	published: { activity: null },
	classes: "history-listview",
	components: [
		{name: "historyList", classes: "history-list", kind: "Repeater", onSetupItem: "setupItem", components: [
			{name: "item", classes: "history-list-item", onclick: "runOldActivity", components: [
				{name: "icon", kind: "Sugar.ActivityIcon", x: 5, y: 4, size: iconSizeFavorite, colorized: true},	
				{name: "name", classes: "history-name"}
			]}
		]}
	],
  
	// Constructor: init list
	create: function() {
		this.inherited(arguments);
		this.activityChanged();
	},
	
	// Activity changed, compute history list
	activityChanged: function() {
		if (this.activity != null)
			this.$.historyList.setCount(Math.min(this.activity.instances.length, maxPopupHistory));
		else
			this.$.historyList.setCount(0);
	},

	// Init setup for a line
	setupItem: function(inSender, inEvent) {
		// Set item in the template
		inEvent.item.$.icon.setActivity(this.activity);
		inEvent.item.$.name.setContent(this.activity.instances[inEvent.index].metadata.title);		
	},
	
	// Click on the item, launch the activity
	runOldActivity: function(inSender, inEvent) {
		preferences.runActivity(this.activity, this.activity.instances[inEvent.index].objectId, this.activity.instances[inEvent.index].metadata.title);
	},	
});