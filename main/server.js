const express = require('express');
const fs = require('fs');
const app = express();
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
const PORT = 3000;

function parseListField(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  try {
    return JSON.parse(String(raw).replace(/'/g, '"'));
  } catch (e) {
    return [];
  }
}
// Load movies from JSON file
let movies = [];

fs.readFile('./movies.json', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading movies.json');
    return;
  }
  movies = JSON.parse(data);
  const rawMovies = JSON.parse(data);

  movies = rawMovies.map(movie => {
    return {
      ...movie,
      movieId: String(movie.movieId || movie.id),
      release_date: String(movie.release_date),
      title: movie.title,
      genres: parseListField(movie.genres),
      spoken_languages: parseListField(movie.spoken_languages),
      production_companies: parseListField(movie.production_companies),
      
    };
  });
});

// Endpoint: GET /movies — list all movies
app.get('/movies', (req, res) => {
  const response = movies.map(movie => {
   
   

    return {
      id: String(movie.movieId || movie.id),
      title: movie.title,
      genres: movie.genres,
      languages: movie.spoken_languages, 
      company: movie.production_companies, 
      release_date: movie.release_date, 
      _links: {
        self: { href: `/movies/${movie.movieId || movie.id}` },
        ui: { href: `/movie.html?id=${movie.id || movie.movieId}` },
        
      },
      description: String(movie.overview),
    };
  });

  res.json(response);
});

// Endpoint: GET /movies/:id — details of a single movie
app.get('/movies/:id', (req, res) => {
  // Find the movie by movieId
  const movie = movies.find(m => m.movieId == req.params.id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });

 
    
 
  res.json({
    id: String(movie.movieId || movie.id),
    title: movie.title,
    genres: movie.genres, 
    languages: movie.spoken_languages,
    company: movie.production_companies,
    release_date: movie.release_date, 
    _links: {
      self: { href: `/movies/${movie.movieId}` },
      ui: { href: `/movie.html?id=${movie.id || movie.movieId}` },
      list: { href: '/movies' },
      
    },
    description: String(movie.overview),
  });
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});