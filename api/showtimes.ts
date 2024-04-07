import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ShowtimeModel } from './_shared/showtimes/showtime.schema.js'
import './_shared/movies/movie.schema.js'
import { withDatabase } from './_shared/db.js'

export default function (request: VercelRequest, response: VercelResponse) {
  return withDatabase(async () => {
    const showtimes = await ShowtimeModel.find().populate('movie').exec()

    return response.send(showtimes)
  })
}
