import type { Config } from '@netlify/functions'
import { withDatabase } from './_shared/db.js'
import { MovieModel } from './_shared/movies/movie.schema.js'
import type { Movie } from './_shared/movies/movie.schema'
import { ShowtimeModel } from './_shared/showtimes/showtime.schema.js'
import type { Showtime } from './_shared/showtimes/showtime.schema'
import { VercelRequest, VercelResponse } from '@vercel/node'

type FilmstadenMovieJson = {
  items: {
    ncgId: string
    filmMainId: string
    title: string
    originalTitle: string
    releaseDate: string
    specialMovie: boolean
    length: number
    genres: {
      name: string
    }[]
    slug: string
    longDescription: string
  }[]
}

type FilmstadenShowJson = {
  items: {
    mId: string // movie id
    mvId: string // movie version id
    utc: string // time
    ct: string // biograf
    st: string // salong
  }[]
}

async function scrapeMovies() {
  const fetched = await fetch(
    'https://services.cinema-api.com/movie/upcoming/sv/1/1024/false'
  )

  const data = (await fetched.json()) as FilmstadenMovieJson

  const models = data.items
    .filter(
      (item) =>
        item.title.toLowerCase().includes('klassiker') || item.specialMovie
    )
    .map<Movie>((item) => ({
      title: item.title,
      sourceId: item.ncgId,
      sourceName: 'filmstaden',
      duration: item.length,
      genres: item.genres ? item.genres.map((genre) => genre.name) : [],
      url: `https://www.filmstaden.se/film/${item.slug}`,
      synopsis: item.longDescription
    }))

  // @ts-expect-error foo
  await MovieModel.upsertMany(models, {
    matchFields: ['sourceId']
  })

  const movies = await MovieModel.find({
    sourceId: models.map((model) => model.sourceId),
    sourceName: 'filmstaden'
  })

  return movies
}

async function scrapeShowtimes(movies: Movie[]) {
  const moviesBySourceId = new Map(
    movies.map((movie) => [movie.sourceId, movie])
  )

  const fetched = await fetch(
    'https://services.cinema-api.com/show/stripped/sv/1/1024/?CountryAlias=se&CityAlias=MA&Channel=Web'
  )

  const data = (await fetched.json()) as FilmstadenShowJson

  const models = data.items
    .filter((showtime) => moviesBySourceId.has(showtime.mId))
    .map<Showtime>((showtime) => ({
      time: new Date(showtime.utc),
      theater: 'filmstaden',
      // @ts-expect-error TODO: property id ObjectId but it should be fine to pass entire document
      movie: moviesBySourceId.get(showtime.mId),
      soldOut: false,
      tags: [],
      url: moviesBySourceId.get(showtime.mId)?.url
    }))

  // @ts-expect-error foo
  const result = ShowtimeModel.upsertMany(models, {
    matchFields: ['movie', 'time']
  })

  return result
}

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse
) {
  return withDatabase(async () => {
    const movies = await scrapeMovies()

    await scrapeShowtimes(movies)

    return response.send('OK!')
  })
}

export const config: Config = {
  schedule: '@hourly'
}
