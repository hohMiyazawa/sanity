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
