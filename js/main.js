document.addEventListener("DOMContentLoaded", () => {

    const starsContainer = document.querySelector(".stars");

    if (!starsContainer) {
        console.log("Stars container not found");
        return;
    }


    const starCount = 120;


    for (let i = 0; i < starCount; i++) {

        const star = document.createElement("div");

        star.className = "star";


        const size = Math.random() * 3 + 1;

        star.style.width = ${size}px;
        star.style.height = ${size}px;

        star.style.left = ${Math.random() * 100}%;
        star.style.top = ${Math.random() * 100}%;

        star.style.animationDelay = ${Math.random() * 5}s;
        star.style.animationDuration = ${2 + Math.random() * 4}s;


        starsContainer.appendChild(star);
    }

});