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

const nav = document.getElementById("nav");
const content = document.getElementById("mainpan");

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

const url = "https://graphql.anilist.co";//Current Anilist API location
let handleResponse = function(response){
	console.log(response.headers.get("x-ratelimit-limit"));
	console.log(response.headers.get("x-ratelimit-remaining"));
	return response.json().then(function(json){
		return (response.ok ? json : Promise.reject(json))
	})
}

function generalAPIcall(query,variables,callback,cache,fatalError){
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
		handleData(null);
		if(fatalError){
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
				component = component.replace(image,`<img width="${imageParts[1] || ""}" src="${imageParts[2]}">`)
			})
			return component
		}
		else{
			return component
		}
	})
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
	return converter.makeHtml(preProcessed.join(""))
}

const globalUserCache = new Set();
const followingUserCache = new Set();

const mediaCache = new Map();

const activity_map = new Map();

class ActivityNode{
	constructor(activity){
		this.cache = {};
		this.activity = activity;
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
		if(activity_map.has(activity.id)){
			activity_map.get(activity.id).activity = activity
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
					globalUserCache.has(activity.user.name)
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
					followingUserCache.has(activity.user.name)
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

let defaultSettings = {
	defaultFeed: "following",
	greenManga: true,
	isTextFeed: true,
	hasRepliesFeed: false
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

if(/#access_token/.test(document.URL)){
	let tokenList = location.hash.split("&").map(a => a.split("="));
	settings.accessToken = tokenList[0][1];
	saveSettings();
	updateUrl("");
	authAPIcall(`query{Viewer{id name}}`,{},function(data){
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
					create("span","label","is text",typeFilter);
					let onlyReplies_input = createCheckbox(typeFilter,false,settings.hasRepliesFeed);
					create("span","label","has replies",typeFilter);
				let createPost = create("div","create",false,content);
				let createText = create("textarea",false,false,createPost);
					createText.setAttribute("autocomplete","off");
					createText.placeholder = "Write a status...";	
				let postContent = create("div","feed",false,content);
				
				let render = function(data){
					console.log("rendering feed!");
					removeChildren(postContent)
					data.forEach(activity => {
						let postWrapper = create("div",false,false,postContent);
						let item = create("div","post","",postWrapper);
						let header = create("div","header",false,item);
						let user = create("span","ilink",activity.user.name,header);
							user.onclick = function(){
								updateUrl("?profile=" + activity.user.name)
							}
						if(activity.type === "TEXT"){
							item.classList.add("text-post");
							let markdown = create("div","markdown",false,item);
							markdown.innerHTML = makeHtml(activity.text);
						}
						else if(activity.type === "MANGA_LIST" || activity.type === "ANIME_LIST"){
							if(activity.status === "dropped"){
								create("span","status"," dropped ",header);
								let media = create("span","ilink",activity.media.title.romaji,header);
								if(activity.type === "ANIME_LIST"){
									media.classList.add("anime")
								}
								else{
									media.classList.add("manga")
								}
								create("span","status"," at " + (activity.type === "ANIME_LIST" ? " episode " : " chapter ")  + activity.progress,header)
							}
							else{
								create("span","status"," " + activity.status + " ",header);
								create("span","status",activity.progress,header);
								create("span","status"," of ",header);
								let media = create("span","ilink",activity.media.title.romaji,header);
								if(activity.type === "ANIME_LIST"){
									media.classList.add("anime")
								}
								else{
									media.classList.add("manga")
								}
							}
						}
						let actions = create("div","actions",false,item);
						let replies = create("span",["action","replies"],(activity.replies.length || "") + "💬",actions);
						let likes = create("span",["action","likes"],(activity.likes.length || "") + "♥️",actions);
						if(activity.likes.some(like => like.name === settings.me.name)){
							likes.classList.add("ILikeThis")
						}
						likes.title = activity.likes.map(user => user.name).join("\n");
					})
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
}
								`,
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
				media{title{romaji}}
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
}
								`,
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
}
							`,
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
				}
					`,
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
								let actions = create("div","actions",false,item);
								let likes = create("span",["action","likes"],(activity.likes.length || "") + "♥️",actions);
								likes.title = activity.likes.map(user => user.name).join("\n")
							})
						}
						//update_cache(data.data.Page.activities,"global_text")
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
			create("div","error","You are not signed in. Go to 'settings' for login options",content);
		}
	},
	{
		name: "Anime",
		action: function(){
			updateUrl("?anime");
		}
	},
	{
		name: "Manga",
		action: function(){
			updateUrl("?manga");
		}
	},
	{
		name: "Browse",
		action: function(){
			updateUrl("?browse");
		}
	},
	{
		name: "Search",
		action: function(){
			updateUrl("?search");
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
			let accessTokenField = create("textarea",false,false,content,"display: block");
			accessTokenField.rows = 3;
			accessTokenField.cols = 30;
			accessTokenField.value = settings.accessToken || "";
			let saveButton = create("button","button","Save",content);
			saveButton.onclick = function(){
				settings.accessToken = accessTokenField.value;
				saveSettings();
				authAPIcall(`query{Viewer{id name}}`,{},function(data){
					if(!data){
						create("p","error","Failed to verify token",content);
						return
					}
					settings.me = data.data.Viewer;
					saveSettings();
				})
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
		location.action()
	}
});
