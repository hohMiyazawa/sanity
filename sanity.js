/*
    sAnity - free client for Anilist.co
    Copyright (C) 2020  hoh miyazawa

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
/*
    Contact:
        https://github.com/hohMiyazawa/sanity
        https://anilist.co/user/hoh/
*/
if(!window.showdown){
	alert("missing file 'showdown.js'")
	throw "fatal error"
}
if(!config){
	alert("missing file 'config.js'")
	window.config = {//generic config
		URL: "",
		API_id: 0,
		API_label: ""
	}
}
if(!window.DOMPurify){
	alert("missing file 'purify.js'. sAnity will still work, but this is a potential security hole");
	window.DOMPurify({sanitize: function(text){return text.replace(/script/i,"")}})//make a token effort anyway
}

function create(type,classes,text,appendLocation,cssText){
	let element = document.createElement(type);
	if(Array.isArray(classes)){
		element.classList.add(...classes);
		if(classes.includes("newTab")){
			element.setAttribute("target","_blank")
		}
	}
	else if(classes){
		if(classes[0] === "#"){
			element.id = classes.substring(1)
		}
		else{
			element.classList.add(classes);
			if(classes === "newTab"){
				element.setAttribute("target","_blank")
			}
		}
	};
	if(text || text === 0){
		element.innerText = text
	};
	if(appendLocation && appendLocation.appendChild){
		appendLocation.appendChild(element)
	};
	if(cssText){
		element.style.cssText = cssText
	};
	return element
}

function createCheckbox(target,id,checked){
	let hohCheckbox = create("label",["hohCheckbox","el-checkbox__input"],false,target);		
	let checkbox = create("input",false,false,hohCheckbox);
	if(id){
		checkbox.id = id
	}
	checkbox.type = "checkbox";
	checkbox.checked = !!checked;
	create("span","el-checkbox__inner",false,hohCheckbox);
	return checkbox
}

function removeChildren(node){
	if(node){
		while(node.childElementCount){
			node.lastChild.remove()
		}
	}
}

function loader(){
	return create("span","loader","Loading ...")
}

const icons = {
	heart: "♥️",
	talk: "💬",
	envelope: "✉",
	cross: "✕",
	like: "♥",
	link: "🔗",
	edit: "✎",
	check: "✓"
}

function saveAs(data,fileName,pureText){
	//todo: support for browsers without blobs?
	let link = create("a");
	document.body.appendChild(link);
	let json = pureText ? data : JSON.stringify(data);
	let blob = new Blob([json],{type: "octet/stream"});
	let url = window.URL.createObjectURL(blob);
	link.href = url;
	link.download = fileName || "File from Anilist.co";
	link.click();
	window.URL.revokeObjectURL(url);
	document.body.removeChild(link);
}

const nav = document.getElementById("nav");
const content = document.getElementById("mainpan");
const sidebar = document.getElementById("sidebar");
const footer = document.getElementById("footer");

const locations = create("div","locations",null,nav);

let aniCast = {postMessage: function(){}};//dummy object for Safari
if(window.BroadcastChannel){
	aniCast = new BroadcastChannel("sanity");
	aniCast.onmessage = function(message){
	}
}
else{
	/* Safari is the most common case where BroadcastChannel is not available.
	 * It *should* be available in most other browsers, so if it isn't here's a message to those where it fails
	 * Safari users can't really do anything about it, so there's no need to nag them, hence the window.safari test
	 * If Apple implements it in the future, the code should be updated, but the code doesn't do anything *wrong* then either
	 * it will just not print the warning when BroadcastChannel isn't available
	 */
	if(!window.safari){
		console.warn("BroadcastChannel not available. sAnity will not be able to share cached data between tabs")
	}
}

const statusList = ["CURRENT","PLANNING","COMPLETED","REPEATING","PAUSED","DROPPED"];

const url = "https://graphql.anilist.co";//Current Anilist API location
let handleResponse = function(response){
	console.log(response.headers.get("x-ratelimit-limit"));
	console.log(response.headers.get("x-ratelimit-remaining"));
	return response.json().then(function(json){
		return (response.ok ? json : Promise.reject(json))
	})
}

function generalAPIcall(query,variables,callback,cache,fatalError){
	console.log("q",query);
	let handleData = function(data){
		callback(data,variables)
	};
	let options = {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Accept": "application/json"
		},
		body: JSON.stringify({
			"query": query,
			"variables": variables
		})
	};
	let handleError = function(error){
		console.error(error,variables);
		handleData(null);
		if(fatalError){
			throw "fatal error"
		}
	};
	fetch(url,options).then(handleResponse).then(handleData).catch(handleError)
}

function authAPIcall(query,variables,callback,cache,fatalError){
	if(!settings.accessToken){
		console.log("authorized query requested, but no access token found. converting to regular query");
		generalAPIcall(query,variables,callback,cache,fatalError);
		return
	}
	let handleData = function(data){
		callback(data,variables)
	};
	let options = {
		method: "POST",
		headers: {
			"Authorization": "Bearer " + settings.accessToken,
			"Content-Type": "application/json",
			"Accept": "application/json"
		},
		body: JSON.stringify({
			"query": query,
			"variables": variables
		})
	};
	let handleError = function(error){
		if(fatalError !== "acceptable" || !error.errors || error.errors.length !== 1 || error.errors[0].message !== "Not Found."){
			console.error(error,variables);
			if(error.errors){
				if(
					error.errors.some(thing => thing.message === "Invalid token")
				){
					settings.accessToken = "";
					saveSettings();
					alert("access token was retracted");
					console.log("access token retracted");
					return
				}
			}
			if(fatalError === "acceptable"){
				throw "fatal error"
			}
		}
		handleData(null);
		if(fatalError === "fatal"){
			throw "fatal error"
		}
	};
	fetch(url,options).then(handleResponse).then(handleData).catch(handleError)
}


showdown.setOption("strikethrough", true);
showdown.setOption("ghMentions", true);
showdown.setOption("emoji", true);
showdown.setOption("tables", false);
showdown.setOption("simpleLineBreaks", true);
showdown.setOption("simplifiedAutoLink", true);
showdown.setOption("ghMentionsLink", "?profile={u}");

const converter = new showdown.Converter();

makeHtml = function(markdown){
	markdown = markdown.replace("----","---");
	let centerSplit = markdown.split("~~~");
	let imgRegex = /img(\d+%?)?\(.+?\)/gi;
	centerSplit = centerSplit.map(component => {
		let images = component.match(imgRegex);
		if(images){
			images.forEach(image => {
				let imageParts = image.match(/^img(\d+%?)?\((.+?)\)$/i);
				if(settings.displayImages && (settings.displayGifs || !imageParts[2].match(/\.gifv?$/i))){
					component = component.replace(image,`<img width="${imageParts[1] || ""}" src="${imageParts[2]}">`)
				}
				else if(!settings.displayGifs && imageParts[2].match(/\.gifv?$/i)){
					component = component.replace(image,`[GIF]<a data-size="${imageParts[1] || ""}" class="supressed-image" href="${imageParts[2]}">${"```" + decodeURIComponent(imageParts[2]) + "```"}</a>`)
				}
				else{
					component = component.replace(image,`[IMG]<a data-size="${imageParts[1] || ""}" class="supressed-image" href="${imageParts[2]}">${"```" + decodeURIComponent(imageParts[2]) + "```"}</a>`)
				}
			})
		}
		return component
	});
	centerSplit = centerSplit.map(component => {
		let images = component.match(/<img src="(.+?)">/gi);
		if(images){
			images.forEach(image => {
				let imageParts = image.match(/<img src="(.+?)">/i);
				if(!settings.displayImages){
					component = component.replace(image,`[IMG]<a class="supressed-image" href="${imageParts[1]}">${"```" + decodeURIComponent(imageParts[1]) + "```"}</a>`)
				}
			})
		}
		return component
	})
	let webmRegex = /webm(\d+%?)?\(.+?\)/gi;
	centerSplit = centerSplit.map(component => {
		let videos = component.match(webmRegex);
		if(videos){
			videos.forEach(video => {
				let videoParts = video.match(/^webm\((.+?)\)$/i);
				if(settings.displayVideos){
					component = component.replace(video,`<video controls="" ${settings.muteVideos ? 'muted=""' : ''} ${settings.autoplayVideos ? 'autoplay=""' : ''} loop="" style="max-width: ${settings.videoMaxwidth}%"><source src="${videoParts[1]}" type="video/webm"></video>`)
				}
				else{
					component = component.replace(video,`[VID]<a class="supressed-video" href="${videoParts[1]}">${videoParts[1]}</a>`)
				}
			})
		}
		return component
	});
	let youtubeRegex = /youtube\(.+?\)/gi;
	centerSplit = centerSplit.map(component => {
		let videos = component.match(youtubeRegex);
		if(videos){
			videos.forEach(video => {
				let videoParts = video.match(/^youtube\((.+?)\)$/i);
				component = component.replace(video,`<a href="${videoParts[1]}">${videoParts[1]}</a>`)
			})
		}
		return component
	});
	let preProcessed = [centerSplit[0]];
	let openCenter = false;
	for(let i=1;i<centerSplit.length;i++){
		if(openCenter){
			preProcessed.push("</center>");
		}
		else{
			preProcessed.push("<center>");
		}
		preProcessed.push(centerSplit[i]);
		openCenter = !openCenter
	}
	preProcessed = preProcessed.map(element => {
		if(/~!/.test(element) || /!~/.test(element)){
			return element.replace(/~!/g,"<span class=\"markdown_spoiler\">").replace(/!~/g,"</span>");
		}
		return element
		
	})
	return DOMPurify.sanitize(converter.makeHtml(preProcessed.join("")))

}

function convertInternalLinks(node){
	node.querySelectorAll('a[href^="?profile"]').forEach(lonk => {
		lonk.onclick = function(e){
			e.preventDefault();
			viewSingleProfile(lonk.href.split("=")[1])
		}
	})
}

function emojiSanitize(string){
	return Array.from(string).map(char => {
		let codePoint = char.codePointAt(0);
		if(codePoint > 0xFFFF){
			return "&#" + codePoint + ";"
		}
		return char
	}).join("")
}

function extractKeywords(text,number){
	number = number || 1;
	let words = text.replace(/(\.\s|\n)/," ").split(" ");
	let sorted = words.sort((b,a) =>
		(words.filter(v => v === a).length
		- words.filter(v => v === b).length)
		|| (a === a.toUpperCase()) - (b === b.toUpperCase())
	).filter(
		word => !["in","the","it","It's","is","are","I","I'm","you","with","for","on","of","this","as","to"].includes(word) && word.length < 30
	)
	if(!sorted.length){
		if(text.match(/img/i)){
			sorted = ["IMG"]
		}
	}
	return sorted.slice(0,number)
}

let relativeTime = function(time){
	let diff = (new Date()).valueOf() - time;
	if(diff < 60*1000){
		return Math.round(diff/1000) + "s"
	}
	else if(diff < 60*60*1000){
		return Math.round(diff/(60*1000)) + "m"
	}
	else if(diff < 24*60*60*1000){
		return Math.round(diff/(60*60*1000)) + "h"
	}
	else{
		return Math.round(diff/(24*60*60*1000)) + "d"
	}
}

let personalAnimeList = null;
let personalMangaList = null;

const globalUserCache = new Set();
const followingUserCache = new Set();

const mediaCache = new Map();
const entryCache = new Map();

const activity_map = new Map();

class ActivityNode{
	constructor(activity){
		this.cache = {};
		this.activity = activity;
		this.updatedAt = (new Date()).valueOf();
		activity_map.set(activity.id,this)
	}
}

const cache_heads = {
	global: null,
	global_text: null,
	following: null,
	following_text: null,
	users: {}
}

const insert_activity_node = function(node,cache_location,cache_name){
	if(!cache_location[cache_name]){
		node.cache[cache_name] = null;
		cache_location[cache_name] = node
	}
	else if(node.activity.id > cache_location[cache_name].activity.id){
		node.cache[cache_name] = cache_location[cache_name];
		cache_location[cache_name] = node
	}
	else{
		let head = cache_location[cache_name];
		let next_head = head.cache[cache_name];
		while(next_head && next_head.activity.id > node.activity.id){
			head = next_head;
			next_head = head.cache[cache_name]
		}
		if(!next_head){
			node.cache[cache_name] = null;
			head.cache[cache_name] = node
		}
		else{
			head.cache[cache_name] = node;
			node.cache[cache_name] = next_head
		}
	}
}

const update_cache = function(activities,type,optionalName){
	activities.forEach(activity => {
		if(activity.type === "ANIME_LIST" || activity.type === "MANGA_LIST"){
			let cacheObject = mediaCache.get(activity.media.id) || {};
			Object.keys(activity.media).forEach(key => cacheObject[key] = activity.media[key]);
			mediaCache.set(activity.media.id,cacheObject)
		}
		if(activity_map.has(activity.id)){
			let node = activity_map.get(activity.id);
			node.activity = activity;
			node.updatedAt = (new Date()).valueOf()
		}
		else{
			let newNode = new ActivityNode(activity);
			if(
				type === "global"
				|| (
					globalUserCache.has(activity.user.name)
					&& (
						activity.type === "TEXT"
						|| (
							activity.type !== "MESSAGE"
							&& activity.replies.length
						)
					)
				)
			){
				insert_activity_node(newNode,cache_heads,"global")
			}
			if(
				type === "global_text"
				|| (
					(
						type === "global"
						|| globalUserCache.has(activity.user.name)
					)
					&& activity.type === "TEXT"
				)
			){
				insert_activity_node(newNode,cache_heads,"global_text")
			}
			if(
				type === "following"
				|| (
					followingUserCache.has(activity.user.name)
					&& activity.type !== "MESSAGE"
				)
			){
				insert_activity_node(newNode,cache_heads,"following")
			}
			if(
				type === "following_text"
				|| (
					(
						type === "following"
						|| followingUserCache.has(activity.user.name)
					)
					&& activity.type === "TEXT"
				)
			){
				insert_activity_node(newNode,cache_heads,"following_text")
			}
		}
	})
}

const retrieve_cache = function(cache_name,amount,filterFunction,optionalName){
	if(!filterFunction){
		filterFunction = function(){return true}
	}
	let returnList = [];
	let head = cache_heads[cache_name];
	while(returnList.length < amount && head){
		if(filterFunction(head.activity)){
			returnList.push(head.activity)
		}
		head = head.cache[cache_name]
	}
	return returnList
}

const deleteActivity = function(id){
	let act = activity_map.get(id);
	if(!act){
		return
	}
	Object.keys(act.cache).forEach(cache => {
		let head = cache_heads[cache];
		if(head.activity.id === id){
			cache_heads[cache] = act.cache[cache]
		}
		else{
			while(head.cache[cache].activity.id !== id){
				head = head.cache[cache]
			}
			head.cache[cache] = act.cache[cache]
		}
	})
	activity_map.delete(id)
}

let defaultSettings = {
	defaultFeed: "following",
	theme: "dark",
	greenManga: true,
	isTextFeed: true,
	hasRepliesFeed: false,
	displayImages: true,
	displayGifs: true,
	displayVideos: true,
	displayOwn: true,
	autoplayVideos: false,
	muteVideos: true,
	videoMaxwidth: 80,
	oldstyle: false,
	openReplies: false,
	pollingInterval: 120,
	confirmDeleteActivity: true,
	mediaPageCover: false,
	mediaPageCover: false,
	cacheDelays: {
		replyHover: 10*60*1000,
		replyClick: 1*60*1000,
		replyReply: 20*1000,
		likeHover: 2*60*1000
		//likeClick: always
	}
};

let settings = defaultSettings;

let savedSettings = JSON.parse(localStorage.getItem("sanity_settings"));
if(savedSettings){
	let keys = Object.keys(savedSettings);
	keys.forEach(//this is to keep the default settings if the version in local storage is outdated
		key => settings[key] = savedSettings[key]
	)
}
let saveSettings = function(){
	localStorage.setItem("sanity_settings",JSON.stringify(settings))
}
saveSettings();

if(settings.mainWidth){
	content.style.width = settings.mainWidth;
	content.style.flex = "0 0 auto"
}

let updateUrl = function(place){
	history.pushState({}, null, place)
}

const basicInfo = `
query{
	Viewer{
		id
		name
		options{
			titleLanguage
			displayAdultContent
			airingNotifications
			profileColor
		}
		mediaListOptions{
			scoreFormat
			rowOrder
			animeList{
				sectionOrder
				splitCompletedSectionByFormat
				customLists
				advancedScoring
				advancedScoringEnabled
				theme
			}
			mangaList{
				sectionOrder
				splitCompletedSectionByFormat
				customLists
				advancedScoring
				advancedScoringEnabled
				theme
			}
		}
	}
}`;

let occupy_sidebar = function(title,destructor){
	//removeChildren(sidebar);
	let fullScreenApp = create("div",["sidebarApp","full"],false,sidebar);
	let appHeader = create("div","app-header",false,fullScreenApp);
	create("h3","title",title,appHeader);
	let cross = create("button","close",icons.cross,appHeader);
	cross.title = "close";
	let appContent = create("div",false,false,fullScreenApp);
	cross.onclick = function(){
		sidebar.removeChild(fullScreenApp);
		if(destructor){
			destructor()
		}
	}
	return appContent
}

let listEditor = function(mediaId,type,fallbackName){
	let editor = occupy_sidebar(fallbackName);
	editor.classList.add("editor");
	let saveButton = create("button","button","Add",editor);
	let spinner = create("span","spinner","…",editor);

	let statusRow = create("p","data-row",false,editor);
	let status = create("select",["editor-input","input-select"],false,statusRow);
	statusList.forEach(stat => {
		let option = create("option","status",stat.toLowerCase(),status);
		option.value = stat
	});
	status.value = "";
	create("span","label","Status",statusRow,"margin-left: 5px");

	let progressRow = create("p","data-row",false,editor);
	let progress = create("input",["editor-input","input-number"],false,progressRow);
	progress.type = "number";
	progress.min = 0;
	progress.step = 1;
	create("span","label","Progress",progressRow,"margin-left: 5px");

	let progressVolumes;
	if(type === "MANGA_LIST"){
		let progressVolumesRow = create("p","data-row",false,editor);
		progressVolumes = create("input",["editor-input","input-number"],false,progressVolumesRow);
		progressVolumes.type = "number";
		progressVolumes.min = 0;
		progressVolumes.step = 1;
		create("span","label","Volumes",progressVolumesRow,"margin-left: 5px");
	}

	let scoreRow = create("p","data-row",false,editor);
	let score = create("input",["editor-input","input-number"],false,scoreRow);
	score.type = "number";
	score.min = 1;
	score.max = 100;
	score.step = 1;
	create("span","label","Score",scoreRow,"margin-left: 5px");

	let startRow = create("p","data-row",false,editor);
	let startDate = create("input",["editor-input","input-date"],false,startRow);
	startDate.type = "date";
	create("span","label","Start date",startRow,"margin-left: 5px");

	let endRow = create("p","data-row",false,editor);
	let endDate = create("input",["editor-input","input-date"],false,endRow);
	endDate.type = "date";
	create("span","label","End date",endRow,"margin-left: 5px");

	let repeatRow = create("p","data-row",false,editor);
	let repeat = create("input",["editor-input","input-number"],false,repeatRow);
	repeat.type = "number";
	repeat.min = 0;
	repeat.step = 1;
	create("span","label","Repeats",repeatRow,"margin-left: 5px");

	create("hr","divider",false,editor);

	let priorityRow = create("p","data-row",false,editor);
	let priority = create("input",["editor-input","input-number"],false,priorityRow);
	priority.type = "number";
	priority.min = 0;
	priority.step = 1;
	create("span","label","Priority",priorityRow,"margin-left: 5px");

	let notes = create("textarea",["editor-input","notes"],false,editor);
	notes.placeholder = "notes";

	create("hr","divider",false,editor);
	saveButton.onclick = function(){
		spinner.style.color = "rgb(var(--color-text))";
		spinner.innerText = "…";
		spinner.title = "saving changes…";
		authAPIcall(
`mutation($mediaId: Int,$progress: Int,$score: Float,$status: MediaListStatus){
	SaveMediaListEntry(mediaId: $mediaId,progress: $progress,score: $score,status: $status){
		mediaId
		progress
		${type === "MANGA_LIST" ? "progressVolumes" : ""}
		status
		notes
		repeat
		priority
		startedAt{year month day}
		completedAt{year month day}
		scoreRaw: score(format: POINT_100)
	}
}`,
			{
				mediaId: mediaId,
				progress: parseInt(progress.value) || 0,
				score: parseFloat(score.value) || 0,
				status: status.value
			},
			function(data){
				if(!data){
					spinner.style.color = "rgb(var(--color-peach))";
					spinner.innerText = icons.cross;
					spinner.title = "saving changes failed";
					return
				}
				spinner.style.color = "rgb(var(--color-green))";
				spinner.innerText = icons.check;
				spinner.title = "changes successfully saved";
				entryCache.set(mediaId,data.data.SaveMediaListEntry);
			}
		)
	}
	let insertValues = function(){
		let entryData = entryCache.get(mediaId);
		if(entryData){
			saveButton.innerText = "Save";
			status.value = entryData.status;
			progress.value = entryData.progress;
			if(type === "MANGA_LIST"){
				progressVolumes.value = entryData.progressVolumes;
			}
			score.value = entryData.scoreRaw || "";
			notes.value = entryData.notes;
			priority.value = entryData.priority;
			repeat.value = entryData.repeat;
			if(entryData.startedAt.year){
				startDate.value = new Date(
					entryData.startedAt.year,
					(entryData.startedAt.month || 1) - 1,
					entryData.startedAt.day || 1
				).toISOString().split("T")[0]
			}
			if(entryData.completedAt.year){
				endDate.value = new Date(
					entryData.completedAt.year,
					(entryData.completedAt.month || 1) - 1,
					entryData.completedAt.day || 1
				).toISOString().split("T")[0]
			}

			let deleteButton = create("button",["button","danger"],"Delete",editor);
			deleteButton.onclick = function(){
				alert("not implemented")
			}
		}
		else{
			saveButton.innerText = "Add"
		}
	}
	if(entryCache.has(mediaId)){
		insertValues()
		spinner.innerText = "";
	}
	else{
		authAPIcall(
`query($id: Int,$name: String){
	MediaList(mediaId: $id,userName: $name){
		mediaId
		progress
		${type === "MANGA_LIST" ? "progressVolumes" : ""}
		status
		notes
		repeat
		priority
		startedAt{year month day}
		completedAt{year month day}
		scoreRaw: score(format: POINT_100)
	}
}`,
			{id: mediaId,name: settings.me.name},
			function(data){
				spinner.innerText = "";
				if(!data){
					entryCache.set(mediaId,null);
					insertValues()
				}
				else{
					entryCache.set(mediaId,data.data.MediaList);
					insertValues()
				}
			},false,"acceptable"
		)
	}
}

if(/#access_token/.test(document.URL)){
	let tokenList = location.hash.split("&").map(a => a.split("="));
	settings.accessToken = tokenList[0][1];
	saveSettings();
	updateUrl("");
	authAPIcall(basicInfo,{},function(data){
		if(!data){
			return
		}
		settings.me = data.data.Viewer;
		saveSettings()
	})
}
if(!settings.me){
	authAPIcall(basicInfo,{},function(data){
		if(!data){
			return
		}
		settings.me = data.data.Viewer;
		saveSettings()
	})
}

let resizer = document.getElementById("resizer");
let isDown = false;
let resizePosition
let mousePosition;
resizer.addEventListener("mousedown",function(e){
	isDown = true;
	resizePosition =  {
		x : event.clientX,
		y : event.clientY
	}
	document.body.classList.add("noselect");
},true);
document.addEventListener("mouseup",function(){
	isDown = false;
	document.body.classList.remove("noselect")
},true);
document.addEventListener("mousemove",function(event){
	event.preventDefault();
	if(isDown){
		mousePosition = {
			x : event.clientX,
			y : event.clientY
		}
		content.style.flex = "none";
		let width = (mousePosition.x - content.parentNode.getBoundingClientRect().left);
		content.style.width = width + "px";
		settings.mainWidth = width + "px";
		saveSettings()
	}
},true);

let formatActivity = function(activity,options){
	let postWrap = create("div","activity",false);
	if(options.standalone){
		postWrap.classList.add("standalone")
	}
	postWrap.dataset.activity = activity.id;
	let item = create("div","post","",postWrap);
	let rightActions = create("div","right-actions",false,item);
		let actLink = create("span","ilink",icons.link,rightActions);
		actLink.title = activity.id;
		actLink.onclick = function(){
			viewSingleActivity(activity.id);
		}
		if(activity.user.name === settings.me.name){
			if(activity.type === "TEXT"){
				let editLink = create("span","ilink",icons.edit,rightActions);
				editLink.title = "edit";
				editLink.onclick = function(){
					document.querySelector(".create textarea").value = activity.text;
					content.scroll({
						top: 0,
						left: 0,
						behavior: "smooth"
					})
				}
			}
			let deleteLink = create("span",["ilink","delete"],icons.cross,rightActions);
			deleteLink.title = "delete activity";
			deleteLink.onclick = function(){
				let confirmAction;
				if(settings.confirmDeleteActivity){
					confirmAction = confirm("Delete activity?")
				}
				else{
					confirmAction = true
				}
				if(confirmAction){
					postWrap.style.display = "none";
					authAPIcall(
						`mutation($id: Int){DeleteActivity(id: $id){deleted}}`,
						{id: activity.id},
						function(data){
							if(!data || !data.data.DeleteActivity.deleted){
								postWrap.style.display = "block"//failed deletion
							}
							else{
								deleteActivity(activity.id)
							}
						}
					)
				}
			}
		}
	let header = create("div","header",false,item);
	let user = create("span","ilink",activity.user.name,header);
	if(activity.user.name === settings.me.name){
		user.classList.add("thisIsMe")
	}
		user.onclick = function(){
			viewSingleProfile(activity.user.name)
		}
	let time = create("time",false,relativeTime(activity.createdAt*1000),item);
	time.setAttribute("datetime",(new Date(activity.createdAt*1000)).toISOString());
	time.title = (new Date(activity.createdAt*1000)).toLocaleString();
	if(activity.type === "TEXT" || activity.type === "MESSAGE"){
		item.classList.add("text-post");
		let markdown = create("div","markdown",false,item);
		markdown.innerHTML = makeHtml(activity.text);
		convertInternalLinks(markdown)
	}
	else if(activity.type === "MANGA_LIST" || activity.type === "ANIME_LIST"){
		if(activity.media){
			let media;
			if(activity.status === "dropped"){
				create("span","status"," dropped ",header);
				media = create("span","ilink",activity.media.title.romaji,header)
			}
			else if(activity.status === "completed"){
				create("span","status"," completed ",header);
				media = create("span","ilink",activity.media.title.romaji,header)
			}
			else{
				create("span","status"," " + activity.status + " ",header);
				create("span","status",activity.progress,header);
				create("span","status"," of ",header);
				media = create("span","ilink",activity.media.title.romaji,header)
			}
			if(activity.type === "ANIME_LIST"){
				media.classList.add("anime");
				media.onclick = function(){
					viewSingleMedia(activity.media.id,"ANIME")
				}
			}
			else{
				media.classList.add("manga");
				media.onclick = function(){
					viewSingleMedia(activity.media.id,"MANGA")
				}
			}
			let editorLink = create("span",["ilink","editor-link"],"→",header);
			editorLink.title = "open list editor";
			editorLink.onclick = function(){
				listEditor(activity.media.id,activity.type,activity.media.title.romaji)
			}
		}
		else{
			if(activity.status === "dropped"){
				create("span","status"," dropped ",header)
			}
			else if(activity.status === "completed"){
				create("span","status"," completed ",header)
			}
			else{
				create("span","status"," " + activity.status + " ",header);
				create("span","status",activity.progress,header)
			}
		}
	}
	let actions = create("div","actions",false,item);
	let replies = create("span",["action","replies"],(activity.replies.length || "") + icons.talk,actions);
	let replyWrap = null;
	replies.onclick = function(){
		postWrap.classList.toggle("replies-open");
		if(replyWrap){
			replyWrap.parentNode.removeChild(replyWrap);
			replyWrap = null
		}
		else{
			replyWrap = create("div","reply-wrap",false,postWrap);
			let createText;
			let replyEditId = null;
			let publishButton;
			activity.replies.forEach(reply => {
				let replyDiv = create("div","reply",false,replyWrap);
				let rightActions = create("div","right-actions",false,replyDiv);
					let replyReplyLink = create("span","ilink","←",rightActions);
					replyReplyLink.title = "mention";
					replyReplyLink.onclick = function(){
						replyWrap.querySelector("textarea").value += "@" + reply.user.name + " "
					}
					if(reply.user.name === settings.me.name){
						let editLink = create("span","ilink",icons.edit,rightActions);
						editLink.title = "edit";
						let deleteLink = create("span",["ilink","delete"],icons.cross,rightActions);
						deleteLink.title = "delete";
						deleteLink.onclick = function(){
							alert("not implemented")
						}
						editLink.onclick = function(){
							createText.value = reply.text;
							replyEditId = reply.id;
							publishButton.innerText = "Update"
						}
					}
				let header = create("div","header",false,replyDiv);
				let time = create("time",false,relativeTime(reply.createdAt*1000),replyDiv);
				time.setAttribute("datetime",(new Date(reply.createdAt*1000)).toISOString());
				time.title = (new Date(activity.createdAt*1000)).toLocaleString();
				let user = create("span","ilink",reply.user.name,header);
					user.onclick = function(){
						updateUrl("?profile=" + activity.user.name)
					}
				let markdown = create("div","markdown",false,replyDiv);
					markdown.innerHTML = makeHtml(reply.text);
					convertInternalLinks(markdown)
				let replyActions = create("div","actions",false,replyDiv);
				let likes = create("span",["action","likes"],(reply.likes.length || "") + icons.like,replyActions);
				if(reply.likes.some(like => like.name === settings.me.name)){
					likes.classList.add("ILikeThis")
				}
				likes.title = reply.likes.map(user => user.name).join("\n");
				likes.onclick = function(){
					let meIndex = reply.likes.findIndex(like => like.name === settings.me.name);
					if(meIndex === -1){
						reply.likes.push({name: settings.me.name})
					}
					else{
						reply.likes.splice(meIndex,1)
					};
					likes.classList.toggle("ILikeThis");
					likes.innerText = (activity.likes.length || "") + icons.like;
					likes.title = reply.likes.map(user => user.name).join("\n");
					authAPIcall(
						"mutation($id:Int){ToggleLike(id:$id,type:ACTIVITY_REPLY){id}}",
						{id: reply.id},
						data => {if(!data){
							console.log("like failed!");
							likes.classList.toggle("ILikeThis")
						}}
					)
				}
			})
			let createReply = create("div","create",false,replyWrap);
			createText = create("textarea",false,false,createReply);
				createText.setAttribute("autocomplete","off");
				createText.placeholder = "Write a reply...";
			publishButton = create("button",["button","publish-action","publish"],"Publish",createReply,"margin-right: 12px;");
			let cancelButton = create("button",["button","publish-action","grey"],"Cancel",createReply);
			let preview = create("div",["preview","markdown"],false,createReply);
				createText.oninput = function(){
					preview.innerHTML = makeHtml(createText.value)
					convertInternalLinks(preview)
				}
				cancelButton.onclick = function(){
					createText.value = "";
					preview.innerHTML = "";
					replyEditId = null;
					publishButton.innerText = "Publish";
					if(activity.replies.length === 0){
						postWrap.classList.toggle("replies-open");
						replyWrap.parentNode.removeChild(replyWrap);
						replyWrap = null
					}
				}
				publishButton.onclick = function(){
					if(createText.value){
						if(!replyEditId){
							publishButton.classList.add("disabled");
							authAPIcall(
								`mutation($text: String,$activityId: Int){SaveActivityReply(text: $text,activityId: $activityId){id}}`,
								{
									text: emojiSanitize(createText.value),
									activityId: activity.id
								},
								function(data){
									publishButton.classList.remove("disabled");
									createText.value = "";
									preview.innerHTML = "";
								}
							)
						}
						else{
							alert("not implemented")
						}
					}
				}
		}
	}
	if(options.openReplies || (options.autoOpen && activity.replies.length)){
		replies.click()
	}
	let likes = create("span",["action","likes"],(activity.likes.length || "") + icons.like,actions);
	if(activity.likes.some(like => like.name === settings.me.name)){
		likes.classList.add("ILikeThis")
	}
	likes.title = activity.likes.map(user => user.name).join("\n");
	likes.onclick = function(){
		let meIndex = activity.likes.findIndex(like => like.name === settings.me.name);
		if(meIndex === -1){
			activity.likes.push({name: settings.me.name})
		}
		else{
			activity.likes.splice(meIndex,1)
		};
		likes.classList.toggle("ILikeThis");
		likes.innerText = (activity.likes.length || "") + icons.like;
		authAPIcall(
			"mutation($id:Int){ToggleLike(id:$id,type:ACTIVITY){id}}",
			{id: activity.id},
			data => {if(!data){
				console.log("like failed!");
				likes.classList.toggle("ILikeThis")
			}}
		)
	}
	return postWrap;
}

let activeTab;

[
	{
		name: "Social",
		isDefault: true,
		action: function(){
			updateUrl("?social");
			if(settings.accessToken){
				removeChildren(content);
				let filter = create("div","filter",false,content);

				let currentFeed = settings.defaultFeed;
				let mode = create("div","modes",false,filter);
					let following = create("span","mode","Following",mode);
					let global = create("span","mode","Global",mode);
					let forum = create("span","mode","Forum",mode);
				let typeFilter = create("div",false,false,filter);
					let onlyText_input = createCheckbox(typeFilter,false,settings.isTextFeed);
					create("span","label","text",typeFilter);
					let onlyReplies_input = createCheckbox(typeFilter,false,settings.hasRepliesFeed);
					create("span","label","replies",typeFilter);
				let createPost = create("div","create",false,content);
				let createText = create("textarea",false,false,createPost);
					createText.setAttribute("autocomplete","off");
					createText.placeholder = "Write a status...";
					createText.rows = 1;
					createText.setAttribute("spellcheck","true");
				let publishButton = create("button",["button","publish-action","publish"],"Publish",createPost,"margin-right: 12px;");
				let cancelButton = create("button",["button","publish-action","grey"],"Cancel",createPost);
				let preview = create("div",["preview","markdown"],false,createPost);
					createText.oninput = function(){
						preview.innerHTML = makeHtml(createText.value);
						createText.rows = createText.value.split("\n").length
					}
					cancelButton.onclick = function(){
						createText.value = "";
						preview.innerHTML = "";
						createText.rows = 1;
					}
					publishButton.onclick = function(){
						if(createText.value){
							publishButton.classList.add("disabled");
							authAPIcall(
								`mutation($text: String){SaveTextActivity(text: $text){id}}`,
								{text: emojiSanitize(createText.value)},
								function(data){
									publishButton.classList.remove("disabled");
									createText.value = "";
									preview.innerHTML = "";
									createText.rows = 1;
									updateMode(currentFeed)
								}
							)
						}
					}

				let postContent = create("div","feed",false,content);
				if(settings.oldstyle){
					postContent.classList.add("oldstyle")
				}
				
				let render = function(data,afterActivity){
					console.log("rendering feed!");
					if(!afterActivity){
						removeChildren(postContent)
					}
					data.forEach(activity => {
						postContent.appendChild(formatActivity(activity,{openReplies: false, autoOpen: settings.openReplies}))
					});
					let loadMore = create("div","load-more","Load More",postContent);
					loadMore.onclick = function(){}
				}
				let updateMode = function(newFeed){
					currentFeed = newFeed;
					if(currentFeed === "following"){
						following.classList.add("active");
						global.classList.remove("active");
						forum.classList.remove("active");
						document.title = "sAnity - feed";
						if(onlyText_input.checked){
							authAPIcall(
									`
query{
	Page(perPage: 25){
		activities(sort: ID_DESC,type: TEXT,isFollowing: true){
			... on TextActivity{
				id
				type
				createdAt
				text
				user{name}
				likes{name}
				replies{
					id
					createdAt
					text
					user{name}
					likes{name}
				}
			}
		}
	}
}`,
								{},
								function(data){
									if(document.querySelector("#nav .active").innerText === "Social" && currentFeed === "following" && onlyText_input.checked){
										if(!data){
											removeChildren(postContent);
											create("div","error","Failed to connect to Anilist",postContent);
											return
										}
										render(data.data.Page.activities)
									}
									else{
										if(!data){return}
									}
									update_cache(data.data.Page.activities,"following_text")
								}
							)
							let cachedData = retrieve_cache("following_text",25);
							if(cachedData.length){
								render(cachedData)
							}
						}
						else{
							authAPIcall(
									`
query{
	Page(perPage: 25){
		activities(sort: ID_DESC,isFollowing: true,type_in:[TEXT,ANIME_LIST,MANGA_LIST]){
			... on TextActivity{
				id
				type
				createdAt
				text
				user{name}
				likes{name}
				replies{
					id
					createdAt
					text
					user{name}
					likes{name}
				}
			}
			... on ListActivity{
				id
				type
				createdAt
				user{name}
				likes{name}
				media{id title{romaji}}
				progress
				status
				replies{
					id
					createdAt
					text
					user{name}
					likes{name}
				}
			}
		}
	}
}`,
								{},
								function(data){
									if(document.querySelector("#nav .active").innerText === "Social" && currentFeed === "following" && !onlyText_input.checked){
										if(!data){
											removeChildren(postContent);
											create("div","error","Failed to connect to Anilist",postContent);
											return
										}
										render(data.data.Page.activities)
									}
									else{
										if(!data){return}
									}
									update_cache(data.data.Page.activities,"following")
								}
							)
							let cachedData = retrieve_cache("following",25);
							if(cachedData.length){
								render(cachedData)
							}
						}
					}
					else if(currentFeed === "global"){
						following.classList.remove("active");
						global.classList.add("active");
						forum.classList.remove("active");
						document.title = "sAnity - global";
						generalAPIcall(
								`
query{
	Page(perPage: 25){
		activities(sort: ID_DESC,type: TEXT){
			... on TextActivity{
				id
				type
				createdAt
				text
				user{name}
				likes{name}
				replies{
					id
					createdAt
					text
					user{name}
					likes{name}
				}
			}
		}
	}
}`,
							{},
							function(data){
								if(document.querySelector("#nav .active").innerText === "Social" && currentFeed === "global"){
									if(!data){
										removeChildren(postContent)
										create("div","error","Failed to connect to Anilist",postContent);
										return
									}
									render(data.data.Page.activities)
								}
								else{
									if(!data){return}
								}
								update_cache(data.data.Page.activities,"global_text")
							}
						)
						let cachedData = retrieve_cache("global_text",25);
						if(cachedData.length){
							render(cachedData)
						}
					}
					else{
						following.classList.remove("active");
						global.classList.remove("active");
						forum.classList.add("active");
						document.title = "sAnity - forum";
						removeChildren(postContent);
						create("div","error","Not yet implemented",postContent);
					}
				};updateMode(currentFeed);
				following.onclick = function(){
					updateMode("following")
				}
				global.onclick = function(){
					updateMode("global")
				}
				forum.onclick = function(){
					updateMode("forum")
				}
				onlyText_input.oninput = function(){
					updateMode(currentFeed);
					settings.isTextFeed = onlyText_input.checked;
					saveSettings()
				}
				onlyReplies_input.oninput = function(){
					updateMode(currentFeed);
					settings.hasRepliesFeed = onlyReplies_input.checked;
					saveSettings()
				}
			}
			else{
				generalAPIcall(
					`
query{
	Page(perPage: 25){
		activities(sort: ID_DESC,type: TEXT){
			... on TextActivity{
				text
				user{name}
				likes{name}
			}
		}
	}
}`,
					{},
					function(data){
						if(document.querySelector("#nav .active").innerText === "Social"){
							removeChildren(content);
							if(!data){
								create("div","error","Failed to connect to Anilist",content);
								return
							}
							data.data.Page.activities.forEach(activity => {
								let item = create("div","post",false,content);
								let header = create("div","header",false,item);
								let user = create("span","ilink",activity.user.name,header);
								let markdown = create("div","markdown",false,item);
								markdown.innerHTML = makeHtml(activity.text);
								convertInternalLinks(markdown)
								let actions = create("div","actions",false,item);
								let likes = create("span",["action","likes"],(activity.likes.length || "") + "♥️",actions);
								likes.title = activity.likes.map(user => user.name).join("\n")
							})
						}
					}
				)
			}
		}
	},
	{
		name: "Profile",
		action: function(){
			updateUrl("?profile");
			removeChildren(content);
			if(!settings.accessToken){
				create("div","error","You are not signed in. Go to 'settings' for login options",content);
				return
			}
			viewSingleProfile(settings.me.name);
		}
	},
	{
		name: "Anime",
		action: function(){
			updateUrl("?animelist");
			document.title = "sAnity - anime list";
			removeChildren(content);
			if(settings.accessToken){
				let renderList = function(){
					if(activeTab !== "Anime"){
						return
					}
					removeChildren(content);
					let listArea = create("div","list-area",false,content);
					personalAnimeList.sort((a,b) => {
							let indexa = settings.me.mediaListOptions.animeList.sectionOrder.indexOf(a.name);
							let indexb = settings.me.mediaListOptions.animeList.sectionOrder.indexOf(b.name);
							if(indexa === indexb){
								return a.name.localeCompare(b.name)
							}
							else if(indexa === -1){
								return 1
							}
							else if(indexb === -1){
								return -1
							}
							return indexa - indexb
					}).forEach(list => {
						let listWrap = create("div","list-wrap",false,listArea);
						let hider = create("span","toggler","[+]",listWrap);
						create("h3","section-name",list.name,listWrap);
						listWrap.appendChild(document.createTextNode(" "));
						create("span","list-count",list.entries.length,listWrap);
						let listSection = create("div","list-section",false,listWrap);
						hider.onclick = function(){
							if(hider.innerText === "[+]"){
								hider.innerText = "[-]";
								listSection.style.display = "none";
							}
							else{
								hider.innerText = "[+]";
								listSection.style.display = "block";
							}
						}
						let anyNotes = list.entries.some(entry => entryCache.get(entry).notes);
						let listHead = create("div","list-head",false,listSection);
							create("span","list-heading","Title",listHead,"width: 30%");
							create("span","list-heading","Episodes",listHead,"width: 10%;text-align: center;");
							create("span","list-heading","Score",listHead,"width: 10%;text-align: center;");
							if(anyNotes){
								create("span","list-heading","Notes",listHead,"width: 10%;text-align: center;");
							}
							if(list.isCustomList){
								create("span","list-heading","Status",listHead,"width: 10%;text-align: center;");
							}
							create("span","list-heading","",listHead,"width: 10px");
						let listEntries = create("div","list-entries",false,listSection);
						list.entries.sort((a,b) => {
							if(settings.me.mediaListOptions.rowOrder === "score"){
								return entryCache.get(b).scoreRaw - entryCache.get(a).scoreRaw || mediaCache.get(a).title.romaji.localeCompare(mediaCache.get(b).title.romaji)
							}
							else{
								return mediaCache.get(a).title.romaji.localeCompare(mediaCache.get(b).title.romaji)
							}
						}).forEach(entry => {
							let media = mediaCache.get(entry);
							let listEntry = entryCache.get(entry);
							let entryRow = create("div","entry",false,listEntries);
							let name = create("span","name",media.title.romaji,entryRow);
							let progress = create("span","progress",listEntry.progress,entryRow);
							if(media.episodes){
								progress.innerText = listEntry.progress + "/" + media.episodes
							}
							let score = create("span","score",listEntry.scoreRaw || "",entryRow);
							if(anyNotes){
								let notes = create("span","notes",(listEntry.notes ? icons.talk : ""),entryRow);
								notes.title = listEntry.notes
							}
							if(list.isCustomList){
								let status = create("span","status",listEntry.status.toLowerCase(),entryRow);
							}
							let editorLink = create("span",["ilink","editor-link"],icons.edit,entryRow);
							editorLink.title = "edit";
							editorLink.onclick = function(){
								listEditor(entry,"ANIME_LIST",media.title.romaji)
							}
						})
					})
				}
				if(personalAnimeList){
					renderList()
				}
				else{
					let loader = create("div",false,"loading list...",content)
					authAPIcall(
`
query($name: String!){
	MediaListCollection(userName: $name, type: ANIME){
		lists{
			name
			isCustomList
			entries{
				... mediaListEntry
			}
		}
	}
}

fragment mediaListEntry on MediaList{
	mediaId
	status
	progress
	repeat
	notes
	startedAt{year month day}
	completedAt{year month day}
	media{
		episodes
		duration
		nextAiringEpisode{episode}
		format
		title{romaji native english}
		tags{id}
		genres
		meanScore
		studios{nodes{isAnimationStudio id name}}
	}
	scoreRaw: score(format: POINT_100)
}`,
						{name: settings.me.name},
						function(data){
							if(!data){
								loader.innerText = "failed to load list";
								console.log("failed to load list");
								return
							}
							personalAnimeList = [];
							data.data.MediaListCollection.lists.forEach(list => {
								let listEntry = {
									name: list.name,
									isCustomList: list.isCustomList,
									entries: []
								};
								list.entries.forEach(entry => {
									let cacheObject = mediaCache.get(entry.mediaId) || {};
									Object.keys(entry.media).forEach(key => cacheObject[key] = entry.media[key]);
									mediaCache.set(entry.mediaId,cacheObject);
									entryCache.set(entry.mediaId,{
										status: entry.status,
										progress: entry.progress,
										type: "ANIME",
										repeat: entry.repeat,
										notes: entry.notes,
										startedAt: entry.startedAt,
										completedAt: entry.completedAt,
										mediaId: entry.mediaId,
										scoreRaw: entry.scoreRaw
									});
									listEntry.entries.push(entry.mediaId)
								});
								personalAnimeList.push(listEntry)
							});
							renderList()
						}
					)
				}
			}
			else{
				create("div","error","You are not signed in. Go to 'settings' for login options",content);
			}
		}
	},
	{
		name: "Manga",
		action: function(){
			updateUrl("?mangalist");
			document.title = "sAnity - manga list";
			removeChildren(content);
			if(settings.accessToken){
				let renderList = function(){
					if(activeTab !== "Manga"){
						return
					}
					removeChildren(content);
					let listArea = create("div","list-area",false,content);
					personalMangaList.sort((a,b) => {
							let indexa = settings.me.mediaListOptions.mangaList.sectionOrder.indexOf(a.name);
							let indexb = settings.me.mediaListOptions.mangaList.sectionOrder.indexOf(b.name);
							if(indexa === indexb){
								return a.name.localeCompare(b.name)
							}
							else if(indexa === -1){
								return 1
							}
							else if(indexb === -1){
								return -1
							}
							return indexa - indexb
					}).forEach(list => {
						let listWrap = create("div","list-wrap",false,listArea);
						let hider = create("span","toggler","[+]",listWrap);
						create("h3","section-name",list.name,listWrap);
						listWrap.appendChild(document.createTextNode(" "));
						create("span","list-count",list.entries.length,listWrap);
						let listSection = create("div","list-section",false,listWrap);
						hider.onclick = function(){
							if(hider.innerText === "[+]"){
								hider.innerText = "[-]";
								listSection.style.display = "none";
							}
							else{
								hider.innerText = "[+]";
								listSection.style.display = "block";
							}
						}
						let anyNotes = list.entries.some(entry => entryCache.get(entry).notes);
						let listHead = create("div","list-head",false,listSection);
							create("span","list-heading","Title",listHead,"width: 30%");
							create("span","list-heading","Chapters",listHead,"width: 10%;text-align: center;");
							create("span","list-heading","Volumes",listHead,"width: 10%;text-align: center;");
							create("span","list-heading","Score",listHead,"width: 10%;text-align: center;");
							if(anyNotes){
								create("span","list-heading","Notes",listHead,"width: 10%;text-align: center;");
							}
							if(list.isCustomList){
								create("span","list-heading","Status",listHead,"width: 10%;text-align: center;");
							}
							create("span","list-heading","",listHead,"width: 10px");
						let listEntries = create("div","list-entries",false,listSection);
						list.entries.sort((a,b) => {
							if(settings.me.mediaListOptions.rowOrder === "score"){
								return entryCache.get(b).scoreRaw - entryCache.get(a).scoreRaw || mediaCache.get(a).title.romaji.localeCompare(mediaCache.get(b).title.romaji)
							}
							else{
								return mediaCache.get(a).title.romaji.localeCompare(mediaCache.get(b).title.romaji)
							}
						}).forEach(entry => {
							let media = mediaCache.get(entry);
							let listEntry = entryCache.get(entry);
							let entryRow = create("div","entry",false,listEntries);
							let name = create("span","name",media.title.romaji,entryRow);
							let progress = create("span","progress",listEntry.progress,entryRow);
							if(media.chapters){
								progress.innerText = listEntry.progress + "/" + media.chapters
							}
							let progressVolumes = create("span","progress-volumes",listEntry.progressVolumes,entryRow);
							if(media.volumes){
								progressVolumes.innerText = listEntry.progressVolumes + "/" + media.volumes
							}
							let score = create("span","score",listEntry.scoreRaw || "",entryRow);
							if(anyNotes){
								let notes = create("span","notes",(listEntry.notes ? icons.talk : ""),entryRow);
								notes.title = listEntry.notes
							}
							if(list.isCustomList){
								let status = create("span","status",listEntry.status.toLowerCase(),entryRow);
							}
							let editorLink = create("span",["ilink","editor-link"],icons.edit,entryRow);
							editorLink.title = "edit";
							editorLink.onclick = function(){
								listEditor(entry,"MANGA_LIST",media.title.romaji)
							}
						})
					})
				}
				if(personalMangaList){
					renderList()
				}
				else{
					let loader = create("div",false,"loading list...",content)
					authAPIcall(
`
query($name: String!){
	MediaListCollection(userName: $name, type: MANGA){
		lists{
			name
			isCustomList
			entries{
				... mediaListEntry
			}
		}
	}
}

fragment mediaListEntry on MediaList{
	mediaId
	status
	progress
	progressVolumes
	repeat
	notes
	startedAt{year month day}
	completedAt{year month day}
	media{
		chapters
		volumes
		format
		title{romaji native english}
		tags{id}
		genres
		meanScore
	}
	scoreRaw: score(format: POINT_100)
}`,
						{name: settings.me.name},
						function(data){
							if(!data){
								loader.innerText = "failed to load list";
								console.log("failed to load list");
								return
							}
							personalMangaList = [];
							data.data.MediaListCollection.lists.forEach(list => {
								let listEntry = {
									name: list.name,
									isCustomList: list.isCustomList,
									entries: []
								};
								list.entries.forEach(entry => {
									let cacheObject = mediaCache.get(entry.mediaId) || {};
									Object.keys(entry.media).forEach(key => cacheObject[key] = entry.media[key]);
									mediaCache.set(entry.mediaId,cacheObject);
									entryCache.set(entry.mediaId,{
										status: entry.status,
										progress: entry.progress,
										progressVolumes: entry.progressVolumes,
										type: "MANGA",
										repeat: entry.repeat,
										notes: entry.notes,
										startedAt: entry.startedAt,
										completedAt: entry.completedAt,
										mediaId: entry.mediaId,
										scoreRaw: entry.scoreRaw
									});
									listEntry.entries.push(entry.mediaId)
								});
								personalMangaList.push(listEntry)
							});
							renderList()
						}
					)
				}
			}
			else{
				create("div","error","You are not signed in. Go to 'settings' for login options",content);
			}
		}
	},
	{
		name: "Browse",
		action: function(){
			updateUrl("?browse");
			removeChildren(content);
			create("p",false,"not implemented",content);
		}
	},
	{
		name: "Search",
		action: function(){
			updateUrl("?search");
			removeChildren(content);
			create("p",false,"not implemented",content);
		}
	},
	{
		name: "Settings",
		action: function(){
			updateUrl("?settings");
			removeChildren(content);
			let login = create("div",false,false,content);
			create("p",false,"Sign in with a client",content);
			if(config.API_id){
				create("p",false,"Default client:",content);
				create("a","newTab",config.API_label || config.API_id,content).href = "https://anilist.co/api/v2/oauth/authorize?client_id=" + config.API_id + "&response_type=token";
				create("p",false,"Fallback client:",content);
			}
			else{
				create("p",false,"Default client:",content);
			}
			create("a","newTab","Github pages client",content).href = "https://anilist.co/api/v2/oauth/authorize?client_id=4168&response_type=token";
			create("p",false,"If the selected client redirects to a different instance of sAnity, you will have to copy-paste the access token into the field below:",content);
			create("p",false,"(If you're using Automail v9.96.3+, you can also grab an access token from the bottom of its settings page. sAnity will then use the same login as Automail)",content);
			let accessTokenField = create("textarea",false,false,content,"display: block");
			accessTokenField.setAttribute("spellcheck","false");
			accessTokenField.setAttribute("wrap","hard");
			accessTokenField.onclick = function(){
				accessTokenField.focus();
				accessTokenField.select()
			}
			accessTokenField.rows = 4;
			accessTokenField.cols = 50;
			accessTokenField.value = settings.accessToken || "";
			let saveButton = create("button","button","Save",content);
			saveButton.onclick = function(){
				settings.accessToken = accessTokenField.value;
				saveSettings();
				authAPIcall(basicInfo,{},function(data){
					if(!data){
						create("p","error","Failed to verify token",content);
						return
					}
					settings.me = data.data.Viewer;
					saveSettings();
				})
			}

			let createCheckboxSetting = function(setting,description){
				let setting_container = create("p","setting",false,content);
				let checkbox = createCheckbox(setting_container,false,settings[setting]);
				create("span","label",description,setting_container);
				checkbox.oninput = function(){
					settings[setting] = checkbox.checked;
					saveSettings()
				}
			}

			create("hr","divider",false,content);
			create("h3",false,"Media settings",content);
			createCheckboxSetting("displayImages","Embed feed images");
			createCheckboxSetting("displayGifs","Embed feed gifs");
			createCheckboxSetting("displayVideos","Embed feed videos");
			createCheckboxSetting("displayOwn","Always embed media in my own posts, regardless of above settings");
			createCheckboxSetting("autoplayVideos","Autoplay videos");
			createCheckboxSetting("muteVideos","Mute videos");
			let videoMaxwidth = create("input",false,false,content,"width: 50px");
			videoMaxwidth.type = "number";
			videoMaxwidth.max = 100;
			videoMaxwidth.min = 0;
			videoMaxwidth.value = settings.videoMaxwidth;
			videoMaxwidth.oninput = function(){
				settings.videoMaxwidth = parseFloat(videoMaxwidth.value);
				saveSettings()
			}
			create("span","label","% Video max width",content);

			create("hr","divider",false,content);

			create("h3",false,"Feed settings",content);
			createCheckboxSetting("renderCards","Render media cards");
			createCheckboxSetting("oldstyle","Oldstyle feed layout");
			createCheckboxSetting("openReplies","Open all replies by default");
			createCheckboxSetting("confirmDeleteActivity","Ask for confirmation when deleting activity");

			create("hr","divider",false,content);

			create("h3",false,"Media page settings",content);
			createCheckboxSetting("mediaPageCover","Include cover image");
			createCheckboxSetting("mediaPageBanner","Include banner");

			create("hr","divider",false,content);

			let exportButton = create("button","button","Export settings",content);
			let importButton = create("button","button","Import settings",content);
			exportButton.onclick = function(){
				saveAs(settings,"sanity settings for " + settings.me.name + ".json")
			};
			importButton.onclick = function(){
				alert("not implemented")
			}
		}
	}
].forEach(location => {
	let span = create("span",["location","ilink"],location.name,locations);
	span.id = "nav-" + location.name;
	if(location.isDefault){
		span.classList.add("active");
		location.action()
	}
	span.onclick = function(){
		document.querySelector("#nav .active").classList.remove("active");
		span.classList.add("active");
		activeTab = location.name;
		location.action()
	}
});

function viewSingleProfile(name){//hot single weebs near you
	removeChildren(content);
	updateUrl("?profile=" + name);
	removeChildren(content);
	create("div",false,"Profile of " + name,content)
}

function viewSingleMedia(id,type){
	if(type === "ANIME"){
		updateUrl("?anime=" + id);
	}
	else{
		updateUrl("?manga=" + id);
	}
	let cacheObject = mediaCache.get(id) || {};
	let selectedIndex = 0;
	let render = function(){
		removeChildren(content);
		if(!Object.keys(cacheObject).length){
			let loader = create("div",false,"loading media...",content);
			return
		}
		let header = create("h3",["title","page-title"],cacheObject.title.romaji,content);
		let subNav = create("div","media-nav",false,content);
		let swapContent = create("div","media-content",false,content);
		let pans = [
			{name: "Overview",
				deploy: function(){
					removeChildren(swapContent);
					let desc = create("p","description",false,swapContent);
					desc.innerHTML = makeHtml(cacheObject.description || "")
				}
			},
			{name: "Staff",
				deploy: function(){
					removeChildren(swapContent);
					create("p",false,"not implemented",swapContent)
				}
			},
			{name: "Characters",
				deploy: function(){
					removeChildren(swapContent);
					create("p",false,"not implemented",swapContent)
				}
			},
			{name: "Reviews",
				deploy: function(){
					removeChildren(swapContent);
					create("p",false,"not implemented",swapContent)
				}
			},
			{name: "Recomendations",
				deploy: function(){
					removeChildren(swapContent);
					create("p",false,"not implemented",swapContent)
				}
			},
			{name: "Social",
				deploy: function(){
					removeChildren(swapContent);
					create("p",false,"Loading ...",swapContent);
					authAPIcall(
`query($id: Int){
	Page(perPage: 25){
		activities(sort: ID_DESC,mediaId: $id){
			... on ListActivity{
				id
				type
				createdAt
				user{name}
				likes{name}
				progress
				status
				replies{
					id
					createdAt
					text
					user{name}
					likes{name}
				}
			}
		}
	}
}`,
						{id: id},
						function(data){
							removeChildren(swapContent);
							let feed = create("div","feed",false,swapContent);
							if(settings.oldstyle){
								feed.classList.add("oldstyle")
							}
							data.data.Page.activities.forEach(act => {
								feed.appendChild(formatActivity(act,{}))
							})
						}
					)
				}
			}
		];
		pans.forEach((pan,index) => {
			let navItem = create("span",false,pan.name,subNav);
			navItem.onclick = function(){
				subNav.children[selectedIndex].classList.remove("active");
				navItem.classList.add("active");
				selectedIndex = index;
				pan.deploy()
			}
		});
		subNav.children[selectedIndex].classList.add("active");
		pans[selectedIndex].deploy();
		if(settings.mediaPageBanner && cacheObject.bannerImage || bannerDB.has(id)){
			let banner = create("div","banner",false,content);
			if(bannerDB.has(id)){
				banner.style.backgroundImage = "url(\"" + bannerDB.get(id) + "\")"
			}
			else{
				banner.style.backgroundImage = "url(\"" + cacheObject.bannerImage + "\")"
			}
			header.style.marginTop = "160px";
			header.style.marginLeft = "7px";
			header.style.color = "rgb(var(--max-contrast))";
			header.style.background = "rgb(var(--color-foreground))";
			header.style.padding = "5px";
			header.style.borderRadius = "5px";
		}
	}
	render();
	if(
		!Object.keys(cacheObject).length
		|| !cacheObject.title
		|| !cacheObject.description
		|| (settings.mediaPageBanner && !cacheObject.hasOwnProperty("bannerImage"))
	){
		generalAPIcall(
`query($id: Int){
	Media(id: $id){
		title{romaji native english}
		description
		bannerImage
	}
}`,
			{id: id},
			function(data){
				Object.keys(data.data.Media).forEach(key => cacheObject[key] = data.data.Media[key]);
				mediaCache.set(id,cacheObject);
				render();
				listEditor(id,type,cacheObject.title.romaji);
			}
		)
	}
	else{
		listEditor(id,type,cacheObject.title.romaji)
	}
}

function viewSingleActivity(id){
	updateUrl("?activity=" + id);
	removeChildren(content);
	if(activity_map.has(id)){
		content.appendChild(formatActivity(activity_map.get(id).activity,{openReplies: true,standalone: true}))
	}
	else{
		content.appendChild(loader())
	}
	authAPIcall(
`query($id: Int){
	Activity(id: $id){
		... on TextActivity{
			id
			type
			createdAt
			text
			user{name}
			likes{name}
			replies{
				id
				createdAt
				text
				user{name}
				likes{name}
			}
		}
		... on MessageActivity{
			id
			type
			createdAt
			text: message
			user: messenger{name}
			recipient{name}
			likes{name}
			replies{
				id
				createdAt
				text
				user{name}
				likes{name}
			}
		}
		... on ListActivity{
			id
			type
			createdAt
			user{name}
			likes{name}
			media{id title{romaji}}
			progress
			status
			replies{
				id
				createdAt
				text
				user{name}
				likes{name}
			}
		}
	}
}`,
		{id: id},
		function(data){
			activity_map.set(id,new ActivityNode(data.data.Activity));
			removeChildren(content);
			content.appendChild(formatActivity(activity_map.get(id).activity,{openReplies: true,standalone: true}))
		}
	)
}

if(settings.accessToken){
	let notificationMenu = create("div",["notifications","ilink"],false,nav);
	create("span","label","Notifications",notificationMenu);
	let notificationCount = create("div","count",false,notificationMenu);
	let notsData;
	let renderRequest = false;
	let sidebarApp = null;
	notificationCount.onclick = function(){
		notificationCount.innerText = "";
		if(notsData && sidebarApp){
			notsData.data.Viewer.unreadNotificationCount = 0
		}
		authAPIcall(
			"query{Notification(resetNotificationCount: true){... on ActivityLikeNotification{id}}}",
			{},
			function(data){}
		)
	}
	let callNots = function(){
		authAPIcall(
`
query{
	Viewer{
		unreadNotificationCount
	}
	Page(perPage: 25){
		notifications{
... on AiringNotification{type episode media{id title{native romaji english}}}
... on FollowingNotification{type user{name}}
... on ActivityMessageNotification{
	type user{name}
	activityId
}
... on ActivityMentionNotification{type user{name}}
... on ActivityReplyNotification{
	type user{name}
	activity{
... on TextActivity{id type}
... on ListActivity{id type progress}
... on MessageActivity{id type}
	}
}
... on ActivityReplySubscribedNotification{
	type user{name}
	activity{
... on TextActivity{
	id
	type
}
... on ListActivity{
	id
	type
	progress
}
	}
}
... on ActivityLikeNotification{
	type user{name}
	activity{
... on TextActivity{
	id
	type
}
... on ListActivity{
	id
	type
	progress
}
	}
}
... on ActivityReplyLikeNotification{
	type user{name}
	activity{
... on TextActivity{
	id
	type
}
... on ListActivity{
	id
	type
	progress
}
	}
}
... on ThreadCommentMentionNotification{type}
... on ThreadCommentReplyNotification{type}
... on ThreadCommentSubscribedNotification{type}
... on ThreadCommentLikeNotification{type}
... on ThreadLikeNotification{type}
... on RelatedMediaAdditionNotification{
	type
	media{id type title{romaji native english}}
}
		}
	}
}`,
			{},
			function(data){
				if(!data){
					return
				}
				notificationCount.innerText = data.data.Viewer.unreadNotificationCount || "";
				notsData = data;
				console.log(data);
				if(renderRequest){
					renderRequest = false;
					renderNots()
				}
			}
		)
	};callNots();
	let poller = setInterval(function(){
		authAPIcall(
			`query{Viewer{unreadNotificationCount}}`,{},
			function(data){
				if(!data){//the network may sometimes fail. No big deal, just silently ignore borked updates
					return
				}
				notificationCount.innerText = data.data.Viewer.unreadNotificationCount || "";
				if(sidebarApp && data.data.Viewer.unreadNotificationCount > notsData.data.Viewer.unreadNotificationCount){
					renderRequest = true;
					callNots()
				}
				notsData.data.Viewer.unreadNotificationCount = data.data.Viewer.unreadNotificationCount
			}
		)
	},settings.pollingInterval*1000)
	let renderNots = function(){
		if(!sidebarApp){
			sidebarApp = occupy_sidebar("Notifications",function(){
				authAPIcall(
					"query{Notification(resetNotificationCount: true){... on ActivityLikeNotification{id}}}",
					{},
					function(data){}
				)
				notificationCount.innerText = "";
				sidebarApp = null
			})
		}
		removeChildren(sidebarApp);
		(notsData ? notsData.data.Page.notifications : []).forEach((notification,index) => {
			let noti = create("div","notification",false,sidebarApp);
			if(notification.user){
				let userLink = create("span","ilink",notification.user.name,noti);
				userLink.onclick = function(){
					viewSingleProfile(notification.user.name)
				}
			}
			if(notification.type === "ACTIVITY_LIKE"){
				create("span",false," liked your ",noti);
				let activityLink = create("span","ilink","activity",noti);
				if(notification.activity.type === "TEXT"){
					activityLink.innerText = "status";
					let cacheItem = activity_map.get(notification.activity.id);
					if(cacheItem){
						create("span",false," [" + extractKeywords(cacheItem.activity.text)[0] + "]",noti)
					}
				}
				if(notification.activity.type === "MANGA_LIST"){
					activityLink.classList.add("manga")
				}
				activityLink.onclick = function(){
					viewSingleActivity(notification.activity.id)
				}
			}
			else if(notification.type === "ACTIVITY_REPLY_LIKE"){
				create("span",false," liked your ",noti);
				let activityLink = create("span","ilink","reply",noti);
				if(notification.activity.type === "TEXT"){
					let cacheItem = activity_map.get(notification.activity.id);
					if(cacheItem){
						create("span",false," [" + extractKeywords(cacheItem.activity.text)[0] + "]",noti)
					}
				}
				activityLink.onclick = function(){
					viewSingleActivity(notification.activity.id)
				}
			}
			else if(notification.type === "ACTIVITY_REPLY_SUBSCRIBED"){
				create("span",false," replied to subscribed ",noti);
				let activityLink = create("span","ilink","activity",noti);
				if(notification.activity.type === "TEXT"){
					activityLink.innerText = "status";
					let cacheItem = activity_map.get(notification.activity.id);
					if(cacheItem){
						create("span",false," [" + extractKeywords(cacheItem.activity.text)[0] + "]",noti)
					}
				}
			}
			else if(notification.type === "ACTIVITY_MESSAGE"){
				create("span",false," sent you a ",noti);
				let activityLink = create("span","ilink","message",noti);
				activityLink.onclick = function(){
					viewSingleActivity(notification.activityId)
				}
			}
			else if(notification.type === "ACTIVITY_REPLY"){
				let action = create("span",false," replied to your ",noti);
				let activityLink = create("span","ilink","activity",noti);
				if(notification.activity.type === "TEXT"){
					activityLink.innerText = "status";
					let cacheItem = activity_map.get(notification.activity.id);
					if(cacheItem){
						create("span",false," [" + extractKeywords(cacheItem.activity.text)[0] + "]",noti)
					}
				}
				else if(notification.activity.type === "MESSAGE"){
					action.innerText = " replied to a ";
					activityLink.innerText = "message";
				}
				activityLink.onclick = function(){
					viewSingleActivity(notification.activity.id)
				}
			}
			else if(notification.type === "RELATED_MEDIA_ADDITION"){
				create("span",false,"New media added: ",noti);
				let mediaLink = create("span","ilink",notification.media.title.romaji,noti);
				if(notification.media.type === "MANGA_LIST"){
					mediaLink.classList.add("manga")
				}
			}
			else if(notification.type === "ACTIVITY_MENTION"){
				create("span",false," mentioned you",noti)
			}
			else if(notification.type === "FOLLOWING"){
				create("span",false," started following you",noti)
			}
			else if(notification.type === "AIRING"){
				create("span",false,"Episode ",noti);
				create("span",false,notification.episode,noti);
				create("span",false," of ",noti);
				let mediaLink = create("span","ilink",notification.media.title.romaji,noti);
				create("span",false," aired",noti);
			}
			else{
				noti.innerText = notification.type
			}
			if((index + 1) === notsData.data.Viewer.unreadNotificationCount){
				create("hr","divider",false,sidebarApp)
			}
		})
	}
	notificationMenu.onclick = function(){
		renderRequest = true;
		renderNots();
		if(!notsData){
			return
		}
		callNots()
	}
}

let versioning = create("span","version","sAnity 0.1 pre-alpha",footer);

let themes = create("div","themes",false,footer);
let darkTheme = create("div",["theme","theme-dark"],"A",themes);
	darkTheme.title = "Dark theme";
darkTheme.onclick = function(){
	document.body.classList.remove("theme-light");
	document.body.classList.add("theme-dark");
	document.body.classList.remove("theme-lum");
	settings.theme = "dark";
	saveSettings()
}
let lightTheme = create("div",["theme","theme-light"],"A",themes);
	lightTheme.title = "Light theme";
lightTheme.onclick = function(){
	document.body.classList.add("theme-light");
	document.body.classList.remove("theme-dark");
	document.body.classList.remove("theme-lum");
	settings.theme = "light";
	saveSettings()
}
let lumTheme = create("div",["theme","theme-lum"],"A",themes);
	lumTheme.title = "Lum theme";
lumTheme.onclick = function(){
	document.body.classList.remove("theme-light");
	document.body.classList.remove("theme-dark");
	document.body.classList.add("theme-lum");
	settings.theme = "lum";
	saveSettings()
}

if(settings.theme === "light"){
	document.body.classList.add("theme-light");
	document.body.classList.remove("theme-dark")
}
else if(settings.theme === "lum"){
	document.body.classList.add("theme-lum");
	document.body.classList.remove("theme-dark")
}

let welcomeBar = occupy_sidebar("Welcome");

create("p",false,"This is the sidebar.",welcomeBar);
create("p",false,"You can put various stuff here, but to get you started, here are a few tips:",welcomeBar);
create("p",false,'1. To sign in, go to "settings" and follow the instructions there',welcomeBar);
create("p",false,"2. Don't reload the page, this kills the efficient cache of sAnity. If you still need to reload the page for any reason, that's a bug and you should report it",welcomeBar);
create("p",false,"3. It's a waste of time talking about sAnity on Anilist.co",welcomeBar);
create("hr","divider",false,welcomeBar);
create("p",false,"News",welcomeBar);
create("p",false,"You are using the pre-alpha version of sAnity. Things are missing and broken!",welcomeBar);
