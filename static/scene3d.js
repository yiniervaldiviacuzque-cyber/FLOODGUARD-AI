document.addEventListener("DOMContentLoaded", () => {
  const pin = document.querySelector(".station-pin span");
  if (!pin) return;

  pin.animate(
    [
      { boxShadow: "0 0 5px #ffb85c" },
      { boxShadow: "0 0 22px #ffb85c" },
      { boxShadow: "0 0 5px #ffb85c" }
    ],
    { duration: 2200, iterations: Infinity }
  );
});
