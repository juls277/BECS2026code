
const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get('id');
const startTime = Date.now();

function updateSessionOnLoad(movieId) {
  const session = JSON.parse(localStorage.getItem('sessionHistory')) || {
    visitedItems: [],
    timeSpent: {},
    transitions: {}
  };

  const idString = String(movieId);

  
 /* if (!session.visitedItems.includes(idString)) {
    session.visitedItems.push(idString);
    
  }*/

 
  localStorage.setItem('sessionHistory', JSON.stringify(session));
  console.log(' updatedSessionOnLoad:', session.visitedItems.slice(-5));
}




fetch(`/movies/${movieId}`)
  .then(res => res.json())
  .then(movie=>{
    //render genres correctly 
     const genreNames = movie.genres.length
      ? movie.genres.map(g => g.name).join(", ")
      : "N/A";
    const langNames = movie.languages.length
      ? movie.languages.map(g => g.name).join(", ")
      : "N/A";
    const compNames = movie.company.length
      ? movie.company.map(g => g.name).join(", ")
      : "N/A";

    document.getElementById('movie-title').textContent = movie.title || 'Untitled';
    document.getElementById('movie-genres').textContent = `Genres: ${genreNames}`;
    document.getElementById('movie-id').textContent = `Movie ID: ${movie.id}`;
    document.getElementById('movie-overview').textContent = `${movie.description || 'No description available'}` ;
    document.getElementById('movie-release').textContent = `Release Date: ${movie.release_date || 'Unknown'}`;
    document.getElementById('languages').textContent = `Languages: ${langNames || 'Unknown'}`;
    document.getElementById('movie-company').textContent = `Production Company: ${compNames || 'Unknown'}`;

    
  })
  .catch(error => {
    console.error('Error fetching then', error);
  });
  
   window.addEventListener('load', () => {
    
    

    updateSessionOnLoad(movieId);
     

     
   
    getMovies();

   
 
    
    });
  // when user leaves or closes the page
  window.addEventListener('beforeunload', () => {
  const secondsSpent = Math.floor((Date.now() - startTime) / 1000);
  const session = JSON.parse(localStorage.getItem('sessionHistory')) || {
    visitedItems: [],
    timeSpent: {}
  };

  session.timeSpent[`item_${movieId}`] =
    (session.timeSpent[`item_${movieId}`] || 0) + secondsSpent;

  localStorage.setItem('sessionHistory', JSON.stringify(session));
  console.log(' Session saved (with time):', session);
});


 //starting recommendation logic 

 

 async function getMovies(){
  
  const session = JSON.parse(localStorage.getItem('sessionHistory')) || {
    visitedItems:[],
    timeSpent:{}
  } 
  const watchedIds = session.visitedItems || [];
  console.log("last 5 watched ids: ", watchedIds.slice(-5));

  try{
   
 

    const res = await fetch('/movies');
    const allMovies = await res.json();
    
  
  /*const watchedMovies = watchedIds
  .map(id => allMovies.find(m => String(m.id || m.movieId) === id))
    */
   const unWatchedMovies = allMovies.filter(m => !watchedIds.includes(String(m.id || m.movieId)));
   const movieMap = new Map(
   allMovies.map(m => [String(m.id || m.movieId), m])
   );
  const watchedMovies = watchedIds.map(id => movieMap.get(id));

  console.log("Watched:", watchedMovies.slice(-5));
   
 
  const topRecommendations = generateRecommendation(watchedMovies, unWatchedMovies, genreSimilarity, 10);

  console.log("Top Recommendations:");
  topRecommendations.forEach((rec, i) => {
  
  const genreNames = Array.isArray(rec.movie.genres)
    ? rec.movie.genres.map(g => g.name).join(", ")
    : "Unknown";

  
  console.log(
    `${i + 1}. ${rec.movie.title} — Genres: [${genreNames}] — Similarity: ${rec.score.toFixed(2)}`
  );

 renderRecommendations(topRecommendations);
});
   


    //ideas:
    //1 take 3-5 the most spentTime on movies
    // apply jaccard similarity to unwatched movies 
    //give out top 3 most similar ones 
    //render html 
   


  } catch(err){
    console.log("couldnt fetch")
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
    a.href = `movie.html?id=${rec.movie.id}`;

    li.appendChild(a);
    list.appendChild(li);
  });
}

 function genreSimilarity(movieA, movieB) {
  const genresA = movieA.genres.map(g => g.name.toLowerCase());
  const genresB = movieB.genres.map(g => g.name.toLowerCase());

  const setA = new Set(genresA);
  const setB = new Set(genresB);

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size || 0; 
}

function generateRecommendation(watchedMovies, unWatchedMovies, similarFn, topN){
  const lastWatched = watchedMovies.slice(-5);
  console.log("Last 5 watched: ", lastWatched);
  const recommendations = [];

  
  if (!unWatchedMovies.length || !lastWatched.length) {
    console.warn("Not enough data to generate recommendations.");
    return [];
  }

  
  for (const unwatched of unWatchedMovies) {
    let totalSim = 0;

    for (const watched of lastWatched) {
      totalSim += similarFn(unwatched, watched);
    }

    const avgSim = totalSim / lastWatched.length;
    recommendations.push({ movie: unwatched, score: avgSim });
  }

  // Sort descending by score
  recommendations.sort((a, b) => b.score - a.score);

 
  console.log("recommended", recommendations.slice(0, topN))
  return recommendations.slice(0, topN);




}