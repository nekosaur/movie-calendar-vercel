import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ShowtimeModel } from '../shared/showtimes/showtime.schema.ts'
import '../shared/movies/movie.schema.ts'
import { withDatabase } from '../shared/db.ts'

export default function (request: VercelRequest, response: VercelResponse) {
  return withDatabase(async () => {
    const showtimes = await ShowtimeModel.find().populate('movie').exec()

    return response.send(showtimes)
  })
}
