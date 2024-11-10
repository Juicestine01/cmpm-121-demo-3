// todo
const app = document.querySelector<HTMLDivElement>("#app")!;
const button = document.createElement("button");
button.addEventListener("click", () => {
  alert("You clicked the button!");
});
button.innerHTML = "click me!";
app.append(button);
