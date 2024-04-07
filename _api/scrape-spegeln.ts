import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withDatabase } from './_shared/db.js'
import { MovieModel } from './_shared/movies/movie.schema.js'
import type { Movie } from './_shared/movies/movie.schema'
import { parse } from 'node-html-parser'
import { ShowtimeModel } from './_shared/showtimes/showtime.schema.js'
import type { Showtime } from './_shared/showtimes/showtime.schema'

type SpegelnNextData = {
  props: {
    pageProps: {
      programList: {
        genre: {
          id: number
          name: string
          alias: string
        }[]
        features: {
          id: number
          url: string
          info: {
            title: string
            synopsis: string
            type: string
            duration: number
            genres: {
              id: number
              name: string
              alias: string
            }[]
            audioLanguage: string
          }
        }[]
        schedule: {
          featureId: string
          dates: {
            startDate: string
            ticksterLink: string
            soldOut: boolean
          }[]
          theme?: {
            id: number
            label: string
          }
        }[]
        themes: {
          id: number
          label: string
        }[]
      }
    }
  }
}

const EXCLUDE_THEMES = [
  1333, // singalong
  1339, // opera
  4283, // quiz
  4082, // balett
  1341 // teater
]

const EXCLUDE_GENRES = [
  1174, // teater
  1172, // balett
  4289, // foaje (quiz)
  1170 // opera
]

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  return withDatabase(async () => {
    const fetched = await fetch('https://biografspegeln.se/program')

    const text = await fetched.text()

    const html = parse(text)

    const script = html.querySelector('script#__NEXT_DATA__')

    if (!script) {
      return
    }

    const json = JSON.parse(script?.rawText) as SpegelnNextData

    const features = json.props.pageProps.programList.features.filter(
      // Sometimes items are mislabeled as FeatureTypeShow when they should be FeatureTypeMovie
      // so for now check genres instead
      // (feature) => feature.info.type === 'FeatureTypeMovie'
      (feature) =>
        !feature.info.genres.some(
          (genre) =>
            EXCLUDE_GENRES.includes(genre.id) && !!feature.info.audioLanguage
        )
    )

    const featureIds = new Set(features.map((feature) => String(feature.id)))

    const models = features.map<Movie>((feature) => {
      return {
        title: feature.info.title,
        sourceId: String(feature.id),
        sourceName: 'spegeln',
        duration: feature.info.duration,
        genres: feature.info.genres
          ? feature.info.genres.map((genre) => genre.name)
          : [],
        url: feature.url,
        synopsis: feature.info.synopsis
      }
    })

    // @ts-expect-error foo
    const result = await MovieModel.upsertMany(models, {
      matchFields: ['sourceId']
    })

    console.log(result)

    const movies = await MovieModel.find({
      sourceId: models.map((model) => model.sourceId),
      sourceName: 'spegeln'
    })

    const moviesBySourceId = new Map(
      movies.map((movie) => [movie.sourceId, movie])
    )

    const schedules = json.props.pageProps.programList.schedule.filter(
      (showtime) =>
        featureIds.has(String(showtime.featureId)) &&
        showtime.theme &&
        !EXCLUDE_THEMES.includes(showtime.theme.id)
    )

    const showtimes = schedules.flatMap((showtime) =>
      showtime.dates.map<Showtime>((date) => ({
        movie: moviesBySourceId.get(String(showtime.featureId))?._id,
        time: new Date(date.startDate),
        theater: 'spegeln',
        soldOut: date.soldOut,
        url: date.ticksterLink,
        tags: showtime.theme ? [showtime.theme?.label] : []
      }))
    )

    // @ts-expect-error foo
    await ShowtimeModel.upsertMany(showtimes, {
      matchFields: ['movie', 'time']
    })

    return response.send('OK!')
  })
}
