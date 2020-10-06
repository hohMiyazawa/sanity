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
showdown.setOption("ghMentionsLink", "https://anilist.co/user/{u}");
const converter = new showdown.Converter();

makeHtml = function(markdown){
	markdown = markdown.replace("----","---");
	let centerSplit = markdown.split("~~~");
	let imgRegex = /img(\d+%?)?\(.+?\)/g;
	centerSplit = centerSplit.map(component => {
		let images = component.match(imgRegex);
		if(images){

			images.forEach(image => {
				let imageParts = image.match(/^img(\d+%?)?\((.+?)\)$/);
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
	return converter.makeHtml(preProcessed.join(""))
}

const mediaCache = new Map();

const activityCache = new Map();
const activityCache_subsets = {
	global: {
		internal: [],
		update: function(data){
		},
		update_following: function(data){
		}
	},
	global_text: {
		internal: [],
		update: function(data){
		},
		update_following: function(data){
		}
	},
	following: {
		internal: [],
		update: function(data){
		},
		update_global: function(data){
		}
	},
	following_text: {
		internal: [],
		update: function(data){
		},
		update_global: function(data){
		}
	},
	users: {
		users: new Map(),
		update: function(data){
		}
	}
};

let defaultSettings = {
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

let updateUrl = function(place){
	location.replace(location.protocol + "//" + location.hostname + location.pathname + place)
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
		content.style.width = (mousePosition.x - content.parentNode.getBoundingClientRect().left) + "px";
	}
},true);

[
	{
		name: "Social",
		isDefault: true,
		action: function(){
			if(settings.accessToken){
				removeChildren(content);
				let filter = create("div","filter",false,content);
				let mode = create("div",false,false,filter);
				let following = create("span",["mode","active"],"Following",mode);
				let global = create("span","mode","Global",mode);
				let forum = create("span","mode","Forum",mode);
				let createPost = create("div","create",false,content);
				let createText = create("textarea",false,false,createPost);
					createText.setAttribute("autocomplete","off");
					createText.placeholder = "Write a status...";	
				let postContent = create("div","feed",false,content);
				authAPIcall(
					`
				query{
					Page(perPage: 25){
						activities(sort: ID_DESC,type: TEXT,isFollowing: true){
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
							removeChildren(postContent);
							if(!data){
								create("div","error","Failed to connect to Anilist",postContent);
								return
							}
							data.data.Page.activities.forEach(activity => {
								let item = create("div","post","",postContent);
								let header = create("div","header",false,item);
								let user = create("span","ilink",activity.user.name,header);
									user.onclick = function(){
										updateUrl("?profile=" + activity.user.name)
									}
								let markdown = create("div","markdown",false,item);
								markdown.innerHTML = makeHtml(activity.text);
								let actions = create("div","actions",false,item);
								let likes = create("span",["action","likes"],(activity.likes.length || "") + "♥️",actions);
								if(activity.likes.some(like => like.name === settings.me.name)){
									likes.classList.add("ILikeThis")
								}
								likes.title = activity.likes.map(user => user.name).join("\n")
							})
						}
						activityCache_subsets.following_text.update(data.data.Page.activities)
					}
				)
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
						activityCache_subsets.global_text.update(data.data.Page.activities)
					}
				)
			}
		}
	},
	{
		name: "Profile",
		action: function(){
			removeChildren(content);
			create("div","error","You are not signed in, and sAnity has no login mechanism yet",content);
		}
	},
	{
		name: "Anime",
		action: function(){}
	},
	{
		name: "Manga",
		action: function(){}
	},
	{
		name: "Browse",
		action: function(){}
	},
	{
		name: "Search",
		action: function(){}
	},
	{
		name: "Settings",
		action: function(){
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
