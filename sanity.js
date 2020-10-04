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

const nav = document.getElementById("nav");
const content = document.getElementById("content");

const locations = create("div","locations",null,nav);

[
	{
		name: "Social",
		action: function(){}
	},
	{
		name: "Profile",
		action: function(){}
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
		name: "Settings",
		action: function(){}
	},
	{
		name: "Help",
		action: function(){}
	}
].forEach(location => {
	let span = create("span",["location","ilink"],location.name,locations);
	span.onclick = location.action
})

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
	APIlimit = response.headers.get("x-ratelimit-limit");
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

showdown.setOption("strikethrough", true);
showdown.setOption("ghMentions", true);
showdown.setOption("emoji", true);
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

generalAPIcall(
	`
query{
	Page(perPage: 25){
		activities(sort: ID_DESC,type: TEXT){
			... on TextActivity{
				text
			}
		}
	}
}
	`,
	{},
	function(data){
		if(!data){
			return
		}
		data.data.Page.activities.forEach(activity => {
			let item = create("div","post","",content);
			item.innerHTML = makeHtml(activity.text)
		})
	}
)


const activityCache = new Map();
const activityCache_subsets = {
	global: {
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
	users: {
		users: new Map(),
		update: function(data){
		}
	}
};





