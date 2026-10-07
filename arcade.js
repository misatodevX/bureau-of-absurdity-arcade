const games = ["games/bureau/", "games/goose/"];
const randomPick = document.querySelector("#randomPick");

randomPick?.addEventListener("click", () => {
  const target = games[Math.floor(Math.random() * games.length)];
  window.location.assign(target);
});
