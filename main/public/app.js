

const startTime = Date.now();

const PAGE_SIZE = 100;

// localStorage keys
const LS_SESSION = "sessionHistory";
const LS_ORDER = "moviesOrder"; // shuffled IDs
const LS_PAGE = "moviesPage";   // current page


window.addEventListener("load", () => {
  const session = JSON.parse(localStorage.getItem(LS_SESSION));
  console.log("Current session on load:", session);
});

window.addEventListener("load", () => {
  const session = JSON.parse(localStorage.getItem(LS_SESSION));
  if (session && session.clicks) {
    delete session.clicks;
    localStorage.setItem(LS_SESSION, JSON.stringify(session));
    console.log("Cleaned old clicks data:", session);
  } else {
    console.log("Session clean: no clicks found");
  }
});


function readSession() {
  return (
    JSON.parse(localStorage.getItem(LS_SESSION)) || {
      visitedItems: [],
      timeSpent: {},
      transitions: {}
    }
  );
}

function writeSession(session) {
  localStorage.setItem(LS_SESSION, JSON.stringify(session));
}

function addVisited(movieId) {
  const session = readSession();
  session.visitedItems = session.visitedItems || [];

  const idStr = String(movieId);
  if (!session.visitedItems.map(String).includes(idStr)) {
    session.visitedItems.push(idStr);
  }

  writeSession(session);
  return session;
}

function getSavedPage() {
  const p = parseInt(localStorage.getItem(LS_PAGE) || "1", 10);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

function setSavedPage(page) {
  localStorage.setItem(LS_PAGE, String(page));
}

function getSavedOrder() {
  try {
    const raw = localStorage.getItem(LS_ORDER);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

function setSavedOrder(orderIds) {
  localStorage.setItem(LS_ORDER, JSON.stringify(orderIds));
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return `#${"00000".substring(0, 6 - c.length) + c}`;
}


fetch("/movies")
  .then(res => res.json())
  .then(movies => {
    const grid = document.getElementById("movie-list");
    if (!grid) return;

    const prevBtn = document.getElementById("prevPage");
    const nextBtn = document.getElementById("nextPage");
    const firstBtn = document.getElementById("firstPage");
    const lastBtn = document.getElementById("lastPage");
    const back10Btn = document.getElementById("back10");
    const back50Btn = document.getElementById("back50");
    const forward10Btn = document.getElementById("forward10");
    const forward50Btn = document.getElementById("forward50");
    const pageInfo = document.getElementById("pageInfo");

    if (
      !prevBtn || !nextBtn || !firstBtn || !lastBtn ||
      !back10Btn || !back50Btn || !forward10Btn || !forward50Btn || !pageInfo
    ) {
      console.error("Pagination elements missing");
      return;
    }

    // Map movies by id 
    const movieMap = new Map(movies.map(m => [String(m.id), m]));
    const allIds = movies.map(m => String(m.id));

    //load saved shuffled order or create a new one
    let order = getSavedOrder();

    const orderIsValid =
      order &&
      order.length === allIds.length &&
      order.every(id => movieMap.has(id));

    if (!orderIsValid) {
      order = [...allIds];
      shuffleInPlace(order);
      setSavedOrder(order);
    }

    const totalPages = Math.max(1, Math.ceil(order.length / PAGE_SIZE));
    let currentPage = Math.min(getSavedPage(), totalPages);

    function renderPage(page) {
      
      currentPage = Math.max(1, Math.min(page, totalPages));
      setSavedPage(currentPage);

      grid.innerHTML = "";

      const start = (currentPage - 1) * PAGE_SIZE;
      const end = Math.min(start + PAGE_SIZE, order.length);

      const frag = document.createDocumentFragment();

      for (let i = start; i < end; i++) {
        const id = order[i];
        const movie = movieMap.get(id);
        if (!movie) continue;

        const card = document.createElement("div");
        card.className = "card";
        card.style.backgroundColor = stringToColor(movie.title || "");

        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = movie.title;

        card.appendChild(title);
        frag.appendChild(card);

        card.addEventListener("click", () => {
          
          const secondsSpent = Math.floor((Date.now() - startTime) / 1000);

          // store visited 
          addVisited(movie.id);

          console.log("Saved session:", readSession(), "secondsSpent(list):", secondsSpent);

          
          localStorage.setItem(
            "currentMovie",
            JSON.stringify({ id: movie.id, openTime: Date.now() })
          );

          
          setSavedPage(currentPage);

          window.location.href = movie._links?.ui?.href;
        });
      }

      grid.appendChild(frag);

      // update UI
      pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
      firstBtn.disabled = currentPage === 1;
      lastBtn.disabled = currentPage === totalPages;
      back10Btn.disabled = currentPage === 1;
      back50Btn.disabled = currentPage === 1;
      prevBtn.disabled = currentPage === 1;
      nextBtn.disabled = currentPage === totalPages;
      forward10Btn.disabled = currentPage === totalPages;
      forward50Btn.disabled = currentPage === totalPages;

      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    firstBtn.addEventListener("click", () => renderPage(1));
    lastBtn.addEventListener("click", () => renderPage(totalPages));
    back10Btn.addEventListener("click", () => renderPage(currentPage - 10));
    back50Btn.addEventListener("click", () => renderPage(currentPage - 50));
    prevBtn.addEventListener("click", () => renderPage(currentPage - 1));
    nextBtn.addEventListener("click", () => renderPage(currentPage + 1));
    forward10Btn.addEventListener("click", () => renderPage(currentPage + 10));
    forward50Btn.addEventListener("click", () => renderPage(currentPage + 50));

    
    renderPage(currentPage);
  })
  .catch(error => {
    console.error("Error fetching movies:", error);
  });
