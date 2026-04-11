import { useState, useEffect, useContext } from 'react'
import Layout from '../../components/Layout'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// School official week calendar - matching system standard
const PARTICIPATION_WEEK_SCHEDULE = {
  midterm_1: [
    { week: 0, label: 'Orientation', range: 'Aug. 17 - Aug. 21' },
    { week: 1, label: 'Week 1', range: 'Aug. 24 - Aug. 28' },
    { week: 2, label: 'Week 2', range: 'Aug. 31 - Sep. 5' },
    { week: 3, label: 'Week 3', range: 'Sep. 7 - Sep. 11' },
    { week: 4, label: 'Week 4', range: 'Sep. 14 - Sep. 18' },
    { week: 5, label: 'Week 5', range: 'Sep. 21 - Sep. 25' },
    { week: 6, label: 'Week 6', range: 'Sep. 28 - Oct. 2' },
    { week: 7, label: 'Week 7', range: 'Oct. 5 - Oct. 9', isNoScore: true, noScoreReason: 'Exam Week' },
  ],
  final_1: [
    { week: 8, label: 'Week 8', range: 'Oct. 12 - Oct. 16' },
    { week: 9, label: 'Week 9', range: 'Oct. 19 - Oct. 23' },
    { week: 10, label: 'Week 10', range: 'Oct. 26 - Oct. 31' },
    { week: 11, label: 'Week 11', range: 'Nov. 2 - Nov. 6' },
    { week: 12, label: 'Week 12', range: 'Nov. 9 - Nov. 13' },
    { week: 13, label: 'Week 13', range: 'Nov. 16 - Nov. 20' },
    { week: 14, label: 'Week 14', range: 'Nov. 23 - Nov. 27' },
    { week: 15, label: 'Week 15', range: 'Nov. 30 - Dec. 4', isNoScore: true, noScoreReason: 'Exam Week' },
  ],
  midterm_2: [
    { week: 16, label: 'Week 16', range: 'Dec. 7 - Dec. 11' },
    { week: 17, label: 'Week 17', range: 'Dec. 14 - Dec. 18' },
    { week: 18, label: 'Week 18', range: 'Dec. 21 - Dec. 25', isNoScore: true, noScoreReason: 'Christmas Break' },
    { week: 19, label: 'Week 19', range: 'Dec. 28 - Jan. 1', isNoScore: true, noScoreReason: 'Christmas Break' },
    { week: 20, label: 'Week 20', range: 'Jan. 4 - Jan. 8' },
    { week: 21, label: 'Week 21', range: 'Jan. 11 - Jan. 15' },
    { week: 22, label: 'Week 22', range: 'Jan. 18 - Jan. 22' },
    { week: 23, label: 'Week 23', range: 'Jan. 25 - Jan. 29' },
    { week: 24, label: 'Week 24', range: 'Feb. 1 - Feb. 5', isNoScore: true, noScoreReason: 'Tet Holiday Break' },
    { week: 25, label: 'Week 25', range: 'Feb. 8 - Feb. 12', isNoScore: true, noScoreReason: 'Tet Holiday Break' },
    { week: 26, label: 'Week 26', range: 'Feb. 15 - Feb. 19' },
    { week: 27, label: 'Week 27', range: 'Feb. 22 - Feb. 26', isNoScore: true, noScoreReason: 'Exam Week' },
  ],
  final_2: [
    { week: 28, label: 'Week 28', range: 'Mar. 1 - Mar. 5' },
    { week: 29, label: 'Week 29', range: 'Mar. 8 - Mar. 12' },
    { week: 30, label: 'Week 30', range: 'Mar. 15 - Mar. 19' },
    { week: 31, label: 'Week 31', range: 'Mar. 22 - Mar. 26' },
    { week: 32, label: 'Week 32', range: 'Mar. 29 - Apr. 2' },
    { week: 33, label: 'Week 33', range: 'Apr. 5 - Apr. 9' },
    { week: 34, label: 'Week 34', range: 'Apr. 12 - Apr. 16' },
    { week: 35, label: 'Week 35', range: 'Apr. 19 - Apr. 23', isNoScore: true, noScoreReason: 'Final Exam Week' },
    { week: 36, label: 'Week 36', range: 'Apr. 26 - Apr. 30', isNoScore: true, noScoreReason: 'Final Exam Week' },
    { week: 37, label: 'Week 37', range: 'May 3 - May 7', isNoScore: true, noScoreReason: 'Post Exam Week' },
    { week: 38, label: 'Week 38', range: 'May 10 - May 14', isNoScore: true, noScoreReason: 'Post Exam Week' },
    { week: 39, label: 'Week 39', range: 'May 17 - May 21', isNoScore: true, noScoreReason: 'Post Exam Week' },
  ],
}

const ALL_WEEKS = [
  ...PARTICIPATION_WEEK_SCHEDULE.midterm_1,
  ...PARTICIPATION_WEEK_SCHEDULE.final_1,
  ...PARTICIPATION_WEEK_SCHEDULE.midterm_2,
  ...PARTICIPATION_WEEK_SCHEDULE.final_2,
]

const LOCATIONS = [
  { id: 'library', name: 'Library', maxBookings: 2 },
  { id: 'physics', name: 'Physics Lab', maxBookings: 1 },
  { id: 'chemistry', name: 'Chemistry Lab', maxBookings: 1 },
  { id: 'ict1', name: 'ICT Lab 1', maxBookings: 1 },
  { id: 'ict2', name: 'ICT Lab 2', maxBookings: 1 },
]

const TIMETABLE = [
  { period: 1, primary: '08:00 - 08:35', secondary: '08:00 - 08:40', label: 'Period 1' },
  { period: 2, primary: '08:35 - 09:10', secondary: '08:45 - 09:25', label: 'Period 2' },
  { period: 3, primary: '09:30 - 10:05', secondary: '09:30 - 10:10', label: 'Period 3' },
  { period: 4, primary: '10:05 - 10:40', secondary: '10:25 - 11:05', label: 'Period 4' },
  { period: 5, primary: '10:40 - 11:15', secondary: '11:10 - 11:50', label: 'Period 5' },
  { period: null, primary: '11:30 - 13:00', secondary: '11:50 - 13:20', label: 'Lunch - Nap Time', isBreak: true },
  { period: 6, primary: '13:30 - 14:05', secondary: '13:30 - 14:10', label: 'Period 6' },
  { period: 7, primary: '14:05 - 14:40', secondary: '14:15 - 14:55', label: 'Period 7' },
  { period: 8, primary: '15:20 - 15:55', secondary: '15:20 - 16:00', label: 'Period 8' },
  { period: 9, primary: '15:55 - 16:30', secondary: '16:05 - 16:45', label: 'Period 9' },
]

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']

export default function ResourceBookings() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [selectedWeek, setSelectedWeek] = useState(ALL_WEEKS[0].week)
  const [selectedLocation, setSelectedLocation] = useState('library')
  const [bookings, setBookings] = useState({})
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [bookingSlot, setBookingSlot] = useState(null)
  const [bookingForm, setBookingForm] = useState({
    staff: '',
    class: '',
    subject: '',
    plan: '',
  })
  const [saving, setSaving] = useState(false)

  const currentWeek = ALL_WEEKS.find(w => w.week === selectedWeek)
  const currentLocation = LOCATIONS.find(l => l.id === selectedLocation)

  useEffect(() => {
    fetchBookings()
  }, [selectedWeek, selectedLocation])

  const fetchBookings = async () => {
    const { data } = await supabase
      .from('resource_bookings')
      .select('*')
      .eq('week', selectedWeek)
      .eq('location_id', selectedLocation)
    
    if (data) {
      const mapped = {}
      data.forEach(b => {
        mapped[`${b.period}-${b.day}`] = b
      })
      setBookings(mapped)
    }
  }

  const openBookingModal = (period, day) => {
    setBookingSlot({ period, day })
    setBookingForm({
      staff: profile?.full_name || '',
      class: '',
      subject: '',
      plan: '',
    })
    setShowBookingModal(true)
  }

  const saveBooking = async () => {
    setSaving(true)
    
    await supabase.from('resource_bookings').insert({
      week: selectedWeek,
      location_id: selectedLocation,
      period: bookingSlot.period,
      day: bookingSlot.day,
      user_id: user.id,
      staff_name: bookingForm.staff,
      class: bookingForm.class,
      subject: bookingForm.subject,
      plan: bookingForm.plan,
    })

    setShowBookingModal(false)
    setSaving(false)
    fetchBookings()
  }

  const cancelBooking = async (id) => {
    await supabase.from('resource_bookings').delete().eq('id', id)
    fetchBookings()
  }

  const canModifyBooking = (booking) => {
    return user && (user.id === booking.user_id || profile?.role === 'admin')
  }

  return (
    <Layout>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 text-sm"
            style={{ backgroundColor: '#1f86c7' }}
          >
            ← Go Back
          </button>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">Resource Booking System</h2>
        <p className="text-gray-500 text-sm mt-1">
          Book school facilities and resources
        </p>
      </div>

      {/* Week Selector */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4">
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => setSelectedWeek(Math.max(0, selectedWeek - 1))}
            disabled={selectedWeek === 0}
            className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ←
          </button>
          <div className="text-center">
            <div className="font-semibold text-lg text-gray-900">{currentWeek?.label}</div>
            <div className="text-sm text-gray-500">{currentWeek?.range}</div>
          </div>
          <button
            onClick={() => setSelectedWeek(Math.min(ALL_WEEKS.length - 1, selectedWeek + 1))}
            disabled={selectedWeek === ALL_WEEKS.length - 1}
            className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            →
          </button>
        </div>
      </div>

      {/* Location Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {LOCATIONS.map(location => (
            <button
              key={location.id}
              onClick={() => setSelectedLocation(location.id)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                selectedLocation === location.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {location.name}
            </button>
          ))}
        </div>
      </div>

      {/* Booking Sheet */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-3 py-2 text-left font-medium text-gray-600 w-[180px]">Time</th>
              {DAYS.map(day => (
                <th key={day} className="px-3 py-2 text-center font-medium text-gray-600">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIMETABLE.map((row, idx) => (
              <tr key={idx} className={row.isBreak ? 'bg-gray-50' : 'border-b border-gray-100'}>
                <td className={`px-3 py-2 border-r border-gray-100 ${row.isBreak ? 'text-center font-medium text-red-600' : ''}`}>
                  <div className="font-medium">{row.label}</div>
                  {row.period && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      Primary: {row.primary}
                      <br />
                      Secondary: {row.secondary}
                    </div>
                  )}
                </td>
                {DAYS.map((day, dayIdx) => {
                  const booking = bookings[`${row.period}-${dayIdx}`]
                  return (
                    <td key={dayIdx} className="px-1 py-1 border-r border-gray-100 align-top">
                      {!row.isBreak && (
                        booking ? (
                          <div className="w-full min-h-[60px] p-2 rounded border border-gray-300 bg-blue-50 text-xs">
                            <div className="font-medium text-gray-800">{booking.staff_name}</div>
                            <div className="text-gray-600">{booking.class} - {booking.subject}</div>
                            {canModifyBooking(booking) && (
                              <button
                                onClick={() => cancelBooking(booking.id)}
                                className="mt-1 text-xs text-red-600 hover:text-red-800"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => openBookingModal(row.period, dayIdx)}
                            className="w-full min-h-[60px] p-1 rounded border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors text-xs text-gray-400 hover:text-blue-600"
                          >
                            + Book
                          </button>
                        )
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Notes */}
        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            <div className="font-medium text-gray-700 mb-2">Notes:</div>
            <ul className="space-y-1 list-disc list-inside text-xs">
              <li>Register for a maximum of {currentLocation?.maxBookings || 2} classes/period to avoid exceeding capacity</li>
              <li>Please have students be quiet when using facilities</li>
              <li>Please return all materials after use</li>
              <li>Please have students tidy up before leaving</li>
            </ul>
          </div>
        </div>
      </div>

    {/* Booking Modal */}
    {showBookingModal && (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h4 className="text-base font-semibold text-gray-900">New Booking</h4>
              <p className="text-xs text-gray-500 mt-1">
                {currentWeek?.label} • {DAYS[bookingSlot?.day]} • Period {bookingSlot?.period}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBookingModal(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close booking modal"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Staff</label>
              <input
                type="text"
                value={bookingForm.staff}
                onChange={(e) => setBookingForm({ ...bookingForm, staff: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
              <input
                type="text"
                value={bookingForm.class}
                onChange={(e) => setBookingForm({ ...bookingForm, class: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
              <input
                type="text"
                value={bookingForm.subject}
                onChange={(e) => setBookingForm({ ...bookingForm, subject: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Plan</label>
              <textarea
                value={bookingForm.plan}
                onChange={(e) => setBookingForm({ ...bookingForm, plan: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[80px] resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveBooking}
                disabled={saving}
                className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#1f86c7' }}
              >
                {saving ? 'Saving...' : 'Save Booking'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </Layout>
  )
}
