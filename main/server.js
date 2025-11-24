const express = require('express');
const fs = require('fs');
const app = express();
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
const PORT = 3000;

// Load movies from JSON file
let movies = [];

fs.readFile('./movies.json', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading movies.json');
    return;
  }
  movies = JSON.parse(data);
  const rawMovies = JSON.parse(data);

  /* Clean poster paths 
  movies = rawMovies.map(movie => {
    if (typeof movie.poster_path === 'string') {
      movie.poster_path = movie.poster_path.replace(/\\/g, '');
    }
    return movie;
  });*/
});

// Endpoint: GET /movies — list all movies
app.get('/movies', (req, res) => {
  const response = movies.map(movie => {
    let parsedGenres = [];
    let spokenLanguages = [];
    let prodCompany = [];

    try {
      
      parsedGenres = JSON.parse(
        movie.genres
          .replace(/'/g, '"') // replace single quotes with double quotes so JSON.parse works
      );
      spokenLanguages = JSON.parse(
        movie.spoken_languages
          .replace(/'/g, '"')


      );
      prodCompany = JSON.parse(
        movie.production_companies
          .replace(/'/g, '"')


      );
    } catch (err) {
      parsedGenres = [];
      spokenLanguages = [];
      prodCompany = [];
    }

    return {
      id: String(movie.movieId || movie.id),
      title: movie.title,
      genres: parsedGenres,
      languages: spokenLanguages, 
      company: prodCompany, 
      release_date: movie.release_date, 
      _links: {
        self: { href: `/movies/${movie.movieId || movie.id}` }
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

 
    let parsedGenres = [];
    let spokenLanguages = [];
    let prodCompany = [];

    try {
      
      parsedGenres = JSON.parse(
        movie.genres
          .replace(/'/g, '"') // replace single quotes with double quotes so JSON.parse works
      );
      spokenLanguages = JSON.parse(
        movie.spoken_languages
          .replace(/'/g, '"')


      );
      prodCompany = JSON.parse(
        movie.production_companies
          .replace(/'/g, '"')


      );
    } catch (err) {
      parsedGenres = [];
      spokenLanguages = [];
      prodCompany = [];
    }

 
  res.json({
    id: String(movie.movieId || movie.id),
    title: movie.title,
    genres: parsedGenres, 
    languages: spokenLanguages,
    company: prodCompany,
    release_date: movie.release_date, 
    _links: {
      self: { href: `/movies/${movie.movieId}` },
      list: { href: '/movies' }
    },
    description: String(movie.overview),
  });
});



// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
