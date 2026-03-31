const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN });
  return client;
}

// POST /api/calendar/create-event
// body: { title, date, endDate?, description?, location? }
router.post('/create-event', async (req, res) => {
  try {
    const { title, date, endDate, description, location } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'title and date are required' });
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
      return res.status(500).json({ error: 'Google Calendar credentials not configured' });
    }

    const auth = getOAuth2Client();
    const calendar = google.calendar({ version: 'v3', auth });

    // For all-day events, end date = next day (Google Calendar convention)
    const startDate = date;
    const endDateFinal = endDate || date;
    // Add 1 day to end for Google Calendar's exclusive end date
    const endDateExclusive = new Date(endDateFinal);
    endDateExclusive.setDate(endDateExclusive.getDate() + 1);
    const endStr = endDateExclusive.toISOString().slice(0, 10);

    const event = {
      summary: title,
      description: description || '',
      location: location || '',
      start: { date: startDate },
      end: { date: endStr },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.json({
      ok: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      event: {
        uid: response.data.id,
        title,
        start: startDate,
        end: endDateFinal,
        description: description || null,
        location: location || null,
        status: 'CONFIRMED',
        daysUntil: Math.ceil((new Date(startDate) - new Date()) / 86400000),
        isPast: new Date(startDate) < new Date(),
      }
    });
  } catch (err) {
    console.error('Calendar create-event error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
