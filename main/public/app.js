const startTime = Date.now();

//additional listener here so session data is always visible during development
window.addEventListener('load', () => {
  const session = JSON.parse(localStorage.getItem('sessionHistory'));
  console.log('Current session on load:', session);
});
//remove old clicks 
window.addEventListener('load', () => {
  const session = JSON.parse(localStorage.getItem('sessionHistory'));
  if (session && session.clicks) {
    delete session.clicks;
    localStorage.setItem('sessionHistory', JSON.stringify(session));
    console.log('Cleaned old clicks data:', session);
  } else {
    console.log('Session clean: no clicks found');
  }
});


//fecth movies 
    fetch('/movies')
  .then(res => res.json())
  .then(movies => {
    const grid = document.getElementById('movie-list');
    
    //i added this slicing here cos my browser constanly freezes if it loads all data set with layouts and stuff
    movies.slice(0,100).forEach(movie => {
      const card = document.createElement('div');
      card.className = 'card';

      // Generate a background color (based on title)
       const color = stringToColor(movie.title || '');
      card.style.backgroundColor = color;

      //title
      const title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = movie.title;

      //add to card
      
      card.appendChild(title);
      grid.appendChild(card);

     
      // create and save session
      card.addEventListener('click', () => {
        const secondsSpent = Math.floor((Date.now() - startTime) / 1000);

        const session = JSON.parse(localStorage.getItem('sessionHistory')) || {
          visitedItems: [],
          timeSpent: {}
        };

        session.visitedItems.push(movie.id);
        

        localStorage.setItem('sessionHistory', JSON.stringify(session));
        console.log('Saved session:', session);

        // store timestamp for tracking time on details page
        localStorage.setItem('currentMovie', JSON.stringify({
          id: movie.id,
          openTime: Date.now()
        }));
        

       /* window.location.href = movie._links?.ui?.href /|| `/movie.html?id=${movie.id}`;*/
       /*window.location.href = movie._links?.self?.href*/
       window.location.href = movie._links?.ui?.href ;
 


        


        
      });
      
    });
  })
  .catch(error => {
    console.error('Error fetching movies:', error);
  });
  function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF)
      .toString(16)
      .toUpperCase();
    return `#${'00000'.substring(0, 6 - c.length) + c}`;
  }

