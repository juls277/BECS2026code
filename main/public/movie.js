
const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get("id");
const startTime = Date.now();

function updateSessionOnLoad(movieId) {
  const session = JSON.parse(localStorage.getItem("sessionHistory")) || {
    visitedItems: [],
    timeSpent: {},
    transitions: {}
  };

  
  /*
  const idString = String(movieId);
  if (!session.visitedItems.length || String(session.visitedItems[session.visitedItems.length - 1]) !== idString) {
    session.visitedItems.push(idString);
  }
  */

  localStorage.setItem("sessionHistory", JSON.stringify(session));
  console.log("updatedSessionOnLoad:", session.visitedItems.slice(-5));
}

fetch(`/movies/${movieId}`)
  .then(res => res.json())
  .then(movie => {
    const genreNames = movie.genres?.length
      ? movie.genres.map(g => g.name).join(", ")
      : "N/A";
    const langNames = movie.languages?.length
      ? movie.languages.map(g => g.name).join(", ")
      : "N/A";
    const compNames = movie.company?.length
      ? movie.company.map(g => g.name).join(", ")
      : "N/A";

    document.getElementById("movie-title").textContent = movie.title || "Untitled";
    document.getElementById("movie-genres").textContent = `Genres: ${genreNames}`;
    document.getElementById("movie-id").textContent = `Movie ID: ${movie.id}`;
    document.getElementById("movie-overview").textContent = movie.description || "No description available";
    document.getElementById("movie-release").textContent = `Release Date: ${movie.release_date || "Unknown"}`;
    document.getElementById("languages").textContent = `Languages: ${langNames || "Unknown"}`;
    document.getElementById("movie-company").textContent = `Production Company: ${compNames || "Unknown"}`;
  })
  .catch(error => {
    console.error("Error fetching movie details:", error);
  });

window.addEventListener("DOMContentLoaded", () => {
  updateSessionOnLoad(movieId);
  getMovies();
});

// when user leaves or closes the page
window.addEventListener("beforeunload", () => {
  const secondsSpent = Math.floor((Date.now() - startTime) / 1000);

  const session = JSON.parse(localStorage.getItem("sessionHistory")) || {
    visitedItems: [],
    timeSpent: {}
  };

  session.timeSpent[`item_${movieId}`] =
    (session.timeSpent[`item_${movieId}`] || 0) + secondsSpent;

  localStorage.setItem("sessionHistory", JSON.stringify(session));
  console.log("Session saved (with time):", session);
});

// =======================
// RECOMMENDATION LOGIC
// =======================

let allMoviesCache = null;

async function getAllMoviesCached() {
  if (allMoviesCache) return allMoviesCache;

  const res = await fetch("/movies");
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);

  const data = await res.json();
  allMoviesCache = data; // cache in memory
  return data;
}

async function getMovies() {
  console.time("getMovies total");

  const session = JSON.parse(localStorage.getItem("sessionHistory")) || {
    visitedItems: [],
    timeSpent: {}
  };

  const watchedIds = (session.visitedItems || []).map(String);
  console.log("last 5 watched ids:", watchedIds.slice(-5));

  try {
    console.time("fetch & cache /movies");
    const allMovies = await getAllMoviesCached();
    console.timeEnd("fetch & cache /movies");

    console.time("split watched/unwatched + map");

    
    const movieMap = new Map(
      allMovies.map(m => [String(m.id || m.movieId), m])
    );

    const unWatchedMovies = allMovies.filter(
      m => !watchedIds.includes(String(m.id || m.movieId))
    );

    
    const watchedMovies = watchedIds.map(id => movieMap.get(String(id))).filter(Boolean);

    console.timeEnd("split watched/unwatched + map");

    console.time("generateRecommendation");
    const topRecommendations = generateRecommendation(
      watchedMovies,
      unWatchedMovies,
      genreSimilarity,
      10,
      session,
      movieMap 
    );
    console.timeEnd("generateRecommendation");

    console.time("renderRecommendations");
    renderRecommendations(topRecommendations);
    console.timeEnd("renderRecommendations");

    console.timeEnd("getMovies total");
  } catch (err) {
    console.log("couldnt fetch", err);
    console.timeEnd("getMovies total");
  }
}

function renderRecommendations(recs) {
  const list = document.getElementById("movie-links");
  if (!list) return;

  list.innerHTML = "";

  recs.slice(0, 5).forEach(rec => {
    const li = document.createElement("li");
    const a = document.createElement("a");

    a.textContent = rec.movie.title;
    a.href = rec.movie._links?.ui?.href ;

    li.appendChild(a);
    list.appendChild(li);
  });
}

function genreSimilarity(movieA, movieB) {
  const genresA = (movieA.genres || []).map(g => (g.name || "").toLowerCase());
  const genresB = (movieB.genres || []).map(g => (g.name || "").toLowerCase());

  const setA = new Set(genresA);
  const setB = new Set(genresB);

  const intersectionSize = [...setA].filter(x => setB.has(x)).length;
  const unionSize = new Set([...setA, ...setB]).size;

  return unionSize ? intersectionSize / unionSize : 0;
}


function getTop5FromLast10ByTime(movieMap, visitedItems, timeSpent) {
  const last10 = (visitedItems || []).slice(-10).map(String);

  // Deduplicate while preserving recency 
  const uniqueLast10NewestFirst = [];
  for (let i = last10.length - 1; i >= 0; i--) {
    const id = last10[i];
    if (!uniqueLast10NewestFirst.includes(id)) uniqueLast10NewestFirst.push(id);
    if (uniqueLast10NewestFirst.length === 10) break;
  }

  const uniqueLast10 = uniqueLast10NewestFirst.reverse();

  const candidates = uniqueLast10
    .map(id => movieMap.get(String(id)))
    .filter(Boolean);

  return candidates
    .map(movie => {
      const id = String(movie.id || movie.movieId);
      return { movie, seconds: timeSpent?.[`item_${id}`] || 0 };
    })
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5)
    .map(x => x.movie);
}

function generateRecommendation(
  watchedMovies,
  unWatchedMovies,
  similarFn,
  topN,
  session,
  movieMap
) {
  const lastWatched = getTop5FromLast10ByTime(
    movieMap,
    session.visitedItems || [],
    session.timeSpent || {}
  );

  console.log("Top 5 from last 10 by time:", lastWatched);

  if (!unWatchedMovies.length || !lastWatched.length) {
    console.warn("Not enough data to generate recommendations.");
    return [];
  }

  const recommendations = [];

  for (const unwatched of unWatchedMovies) {
    let totalSim = 0;

    for (const watched of lastWatched) {
      totalSim += similarFn(unwatched, watched);
    }

    const avgSim = totalSim / lastWatched.length;
    recommendations.push({ movie: unwatched, score: avgSim });
  }

  recommendations.sort((a, b) => b.score - a.score);
  console.log("recommended", recommendations.slice(0, topN));
  return recommendations.slice(0, topN);
}
