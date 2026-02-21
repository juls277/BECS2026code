

const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get("id"); // string from URL
const detailsStartTime = Date.now();


//session
function readSession() {
  return (
    JSON.parse(localStorage.getItem("sessionHistory")) || {
      visitedItems: [],
      timeSpent: {},
      transitions: {}
    }
  );
}

function writeSession(session) {
  localStorage.setItem("sessionHistory", JSON.stringify(session));
}

function addVisited(movieIdToAdd) {
  const session = readSession();
  session.visitedItems = session.visitedItems || [];

  const idStr = String(movieIdToAdd);

  if (!session.visitedItems.map(String).includes(idStr)) {
    session.visitedItems.push(idStr);
  }

  writeSession(session);
  return session;
}

// we recors current movie as visited
function updateSessionOnLoad(currentMovieId) {
  const session = addVisited(currentMovieId);
  console.log("[SESSION] visitedItems (last 20 ids):", session.visitedItems.slice(-30));
  console.log("[SESSION] current movieId:", String(currentMovieId));
}

//render movie
function normalizeGenreNames(genres) {
  if (!Array.isArray(genres)) return [];
  return genres
    .map(g => (typeof g === "string" ? g : g?.name))
    .filter(Boolean)
    .map(s => String(s).toLowerCase().trim());
}

function normalizeNameList(list) {
  if (!Array.isArray(list)) return "N/A";
  const names = list
    .map(x => (typeof x === "string" ? x : x?.name))
    .filter(Boolean);
  return names.length ? names.join(", ") : "N/A";
}

function loadMovieDetails() {
  fetch(`/movies/${movieId}`)
    .then(res => res.json())
    .then(movie => {
      document.getElementById("movie-title").textContent = movie.title || "Untitled";
      document.getElementById("movie-genres").textContent = `Genres: ${normalizeNameList(movie.genres)}`;
      document.getElementById("movie-id").textContent = `Movie ID: ${movie.id}`;
      document.getElementById("movie-overview").textContent = movie.description || "No description available";
      document.getElementById("movie-release").textContent = `Release Date: ${movie.release_date || "Unknown"}`;
      document.getElementById("languages").textContent = `Languages: ${normalizeNameList(movie.languages)}`;
      document.getElementById("movie-company").textContent = `Production Company: ${normalizeNameList(movie.company)}`;

      console.log("[DETAILS] Loaded movie:", { id: String(movie.id), title: movie.title });
    })
    .catch(error => {
      console.error("[DETAILS] Error fetching movie details:", error);
    });
}

// track time
window.addEventListener("beforeunload", () => {
  const secondsSpent = Math.floor((Date.now() - detailsStartTime) / 1000);
  const session = readSession();

  session.timeSpent = session.timeSpent || {};
  const idStr = String(movieId);

  session.timeSpent[`item_${idStr}`] = (session.timeSpent[`item_${idStr}`] || 0) + secondsSpent;

  writeSession(session);

  console.log("[TIME] Saved time spent:", {
    movieId: idStr,
    secondsSpentThisVisit: secondsSpent,
    totalSecondsForMovie: session.timeSpent[`item_${idStr}`]
  });
});

//recommendation logic

let allMoviesCache = null;

async function getAllMoviesCached() {
  if (allMoviesCache) {
    console.log("[CACHE] /movies served from memory cache:", allMoviesCache.length);
    return allMoviesCache;
  }

  console.log("[CACHE] Fetching /movies ...");
  const res = await fetch("/movies");
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);

  const data = await res.json();
  allMoviesCache = data;

  console.log("[CACHE] /movies fetched and cached:", data.length);
  return data;
}

function genreSimilarity(movieA, movieB) {
  const genresA = normalizeGenreNames(movieA.genres);
  const genresB = normalizeGenreNames(movieB.genres);

  const setA = new Set(genresA);
  const setB = new Set(genresB);

  const intersectionSize = [...setA].filter(x => setB.has(x)).length;
  const unionSize = new Set([...setA, ...setB]).size;

  return unionSize ? intersectionSize / unionSize : 0;
}


function getTop10SeedsFromLast20ByTime(movieMap, visitedItems, timeSpent) {
  const MIN_SECONDS = 5;
  const MAX_SECONDS = 10 * 60; // 600

  // pick last 20 ids
  const last20 = (visitedItems || []).slice(-20).map(String);

  //  dedupe while preserving recency (newest kept)
  const uniqueNewestFirst = [];
  for (let i = last20.length - 1; i >= 0; i--) {
    const id = last20[i];
    if (!uniqueNewestFirst.includes(id)) uniqueNewestFirst.push(id);
    if (uniqueNewestFirst.length === 20) break;
  }
  const uniqueLast20 = uniqueNewestFirst.reverse();

  
  const candidates = uniqueLast20
    .map(id => movieMap.get(String(id)))
    .filter(Boolean);

  
  const scored = candidates
    .map(movie => {
      const id = String(movie.id || movie.movieId);
      return { movie, seconds: timeSpent?.[`item_${id}`] || 0 };
    })
    .filter(x => x.seconds > MIN_SECONDS && x.seconds < MAX_SECONDS)
    .sort((a, b) => b.seconds - a.seconds);

  // pick top 10 
  const top10 = scored.slice(0, 10);

  console.log("[REC INPUT] last20 watched (raw):", last20);
  console.log("[REC INPUT] last20 watched (deduped):", uniqueLast20);

  console.log(
    "[REC INPUT] Candidate pool from last20 (time constrained):",
    scored.map(x => ({
      id: String(x.movie.id || x.movie.movieId),
      title: x.movie.title,
      seconds: x.seconds
    }))
  );

  console.log(
    "[REC INPUT] TOP 10 seeds picked (by time, constrained):",
    top10.map(x => ({
      id: String(x.movie.id || x.movie.movieId),
      title: x.movie.title,
      seconds: x.seconds
    }))
  );

  return top10.map(x => x.movie);
}

function generateRecommendation(unWatchedMovies, session, movieMap, topN = 20) {
  const seeds = getTop10SeedsFromLast20ByTime(
    movieMap,
    session.visitedItems || [],
    session.timeSpent || {}
  );

  if (!unWatchedMovies.length || !seeds.length) {
    console.warn("[REC] Not enough data to generate recommendations.", {
      unWatchedCount: unWatchedMovies.length,
      seedCount: seeds.length
    });
    return [];
  }

  console.log("[REC] Unwatched candidates:", unWatchedMovies.length);
  console.log("[REC] Seed count used for similarity:", seeds.length);

  const recommendations = [];

  for (const unwatched of unWatchedMovies) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const watched of seeds) {
      const watchedId = String(watched.id || watched.movieId);

      // seconds user spent on this seed
      const seconds = session.timeSpent?.[`item_${watchedId}`] || 0;

      
      const weight = Math.min(seconds, 10 * 60);

      const sim = genreSimilarity(unwatched, watched);

      weightedSum += sim * weight;
      totalWeight += weight;
    }

    // weighted average similarity
    const score = totalWeight ? (weightedSum / totalWeight) : 0;

    recommendations.push({ movie: unwatched, score });
  }

  // Sort by score descending
  recommendations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    //return Math.random() - 0.5; // tie-break
  });

  console.log(
    "[REC OUTPUT] Top recommendations (with weighted score):",
    recommendations.slice(0, topN).map(r => ({
      id: String(r.movie.id || r.movie.movieId),
      title: r.movie.title,
      score: Number(r.score.toFixed(4))
    }))
  );

  return recommendations.slice(0, topN);
}

 

function renderRecommendations(recs) {
  const list = document.getElementById("movie-links");
  if (!list) return;

  list.innerHTML = "";

  console.log(
    "[UI] Rendering recommendations (top 5):",
    recs.slice(0, 5).map(r => ({
      id: String(r.movie.id || r.movie.movieId),
      title: r.movie.title,
      score: Number((r.score ?? 0).toFixed(4))
    }))
  );

  recs.slice(0, 5).forEach(rec => {
    const movie = rec.movie;
    const li = document.createElement("li");
    const a = document.createElement("a");

    const idStr = String(movie.id || movie.movieId);

    a.textContent = movie.title;
    a.href = movie._links?.ui?.href;

    // Mark as visited before navigation
    a.addEventListener("click", () => {
      console.log("[CLICK] Recommendation clicked:", { id: idStr, title: movie.title });
      addVisited(idStr);
    });

    li.appendChild(a);
    list.appendChild(li);
  });
}

async function getMoviesAndRecommend() {
  console.time("getMovies total");

  // Ensure current is visited (safe + deduped)
  addVisited(movieId);

  const session = readSession();

  console.log("[SESSION] visitedItems (last 20 ids):", (session.visitedItems || []).slice(-20));
  console.log("[SESSION] timeSpent keys:", Object.keys(session.timeSpent || {}).length);

  const watchedSet = new Set((session.visitedItems || []).map(String));
  const currentIdStr = String(movieId);

  try {
    const allMovies = await getAllMoviesCached();

    const movieMap = new Map(allMovies.map(m => [String(m.id || m.movieId), m]));

    //  not visited AND not current movie
    const unWatchedMovies = allMovies.filter(m => {
      const idStr = String(m.id || m.movieId);
      return idStr !== currentIdStr && !watchedSet.has(idStr);
    });

    console.log("[REC] watchedSet size:", watchedSet.size);
    console.log("[REC] currentIdStr:", currentIdStr);
    console.log("[REC] unWatchedMovies size:", unWatchedMovies.length);

    const topRecommendations = generateRecommendation(unWatchedMovies, session, movieMap, 20);
    renderRecommendations(topRecommendations);

    console.timeEnd("getMovies total");
  } catch (err) {
    console.error("[REC] couldnt fetch /movies or generate recs:", err);
    console.timeEnd("getMovies total");
  }
}

//start
window.addEventListener("DOMContentLoaded", () => {
  updateSessionOnLoad(movieId);
  loadMovieDetails();
  getMoviesAndRecommend();
});