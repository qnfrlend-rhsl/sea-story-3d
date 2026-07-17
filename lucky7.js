console.log("🍀 Lucky7 시작");
const luckySites = [

    {
        name:"우동폰",
        image:"lucky7-images/udongpon.png",
        url:"https://udongpon.netlify.app/",
        desc:"스마트한 정보와 다양한 콘텐츠를 만나보세요."
    },

    {
        name:"Sea Story",
        image:"lucky7-images/sea-story.png",
        url:"https://sea-story-3d-rhsl.netlify.app/",
        desc:"시원한 바다 테마와 재미있는 게임을 즐겨보세요."
    },

    {
        name:"춘천사랑 농축임수 센터",
        image:"lucky7-images/gaga-shop.png",
        url:"https://gaga-shop.netlify.app/",
        desc:"믿을 수 있는 농축임수 상품을 만나보세요."
    }

];

// 🍀 현재 광고 번호
let luckyIndex =
Number(localStorage.getItem("luckyIndex")) || 0;

function showLucky7(){

    // 현재 보여줄 광고 저장
    let currentIndex =
    Number(localStorage.getItem("luckyIndex")) || 0;

    // 다음 광고 번호 예약
    let nextIndex = currentIndex + 1;

    if(nextIndex >= luckySites.length){
        nextIndex = 0;
    }

    localStorage.setItem(
        "luckyIndex",
        nextIndex
    );

    const modal = document.createElement("div");

    modal.className = "lucky7-modal";
    modal.innerHTML = `
        <div class="lucky7-content">

            <h2>
                🍀 Lucky 7 Event 🍀
            </h2>

            <img
                class="lucky7-image"
                src="${luckySites[currentIndex].image}"
                alt="${luckySites[currentIndex].name} 광고"
            >
            <h3 class="lucky7-site-name">
                ${luckySites[currentIndex].name}
            </h3>

            <p class="lucky7-site-desc">
                ${luckySites[currentIndex].desc}
            </p>

            <p class="lucky7-timer">
                ⏳ 행운의 7 : 
                <span id="lucky7-count">7</span>
            </p>

            <p class="lucky7-message">
                7초 후 행운이 활성화됩니다.
            </p>

            <button class="lucky7-visit">
                🌐 홈페이지 방문
            </button>

            <button class="lucky7-close" disabled>
                닫기
            </button>
        </div>

    `;

    document.body.appendChild(modal);

    const timer =
    document.getElementById("lucky7-count");

    const visitBtn =
    document.querySelector(".lucky7-visit");

    const closeBtn =
    document.querySelector(".lucky7-close");

    const message =
    document.querySelector(".lucky7-message");

    let luckyTime = 7;

    const luckyTimer = setInterval(() => {
        luckyTime--;
        timer.textContent = luckyTime;

        if(luckyTime <= 0){
            clearInterval(luckyTimer);
            timer.textContent = "🍀행운!";
            message.textContent =
            "🎉 행운의 시간이 시작되었습니다!";
            closeBtn.disabled = false;
        }
    },1000);

    /*
    =========================
    홈페이지 방문 버튼
    =========================
    */
    visitBtn.addEventListener("click",()=>{
        window.open(
            luckySites[currentIndex].url,
            "_blank"
        );
    });

    /*
    =========================
    닫기 버튼
    =========================
    */
    closeBtn.addEventListener("click",()=>{
        modal.remove();
    });

}