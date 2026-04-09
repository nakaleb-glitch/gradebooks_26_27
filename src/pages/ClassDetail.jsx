import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { normalizeLinkUrl, uploadTeacherAnnouncementPdf } from '../lib/announcementAttachments'
import AnnouncementPdfButton from '../components/AnnouncementPdfButton'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'

const TERMS = [
  { key: 'midterm_1', label: 'Midterm 1', weeks: 8 },
  { key: 'final_1', label: 'Final 1', weeks: 8 },
  { key: 'midterm_2', label: 'Midterm 2', weeks: 12 },
  { key: 'final_2', label: 'Final 2', weeks: 12 },
]

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

const getTermDateSummary = (termKey) => {
  const weeks = PARTICIPATION_WEEK_SCHEDULE[termKey] || []
  if (weeks.length === 0) return null

  const firstRange = weeks[0]?.range || ''
  const lastRange = weeks[weeks.length - 1]?.range || ''

  const firstDate = firstRange.split('-')[0]?.trim() || ''
  const lastDate = lastRange.split('-')[1]?.trim() || ''
  if (!firstDate || !lastDate || firstDate === 'Date TBD' || lastDate === 'Date TBD') return null

  return `${firstDate} - ${lastDate}`
}

export default function ClassDetail() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [cls, setCls] = useState(null)
  const [selectedTerm, setSelectedTerm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasUnsavedGradebook, setHasUnsavedGradebook] = useState(false)
  const [studentRoster, setStudentRoster] = useState([])
  const [classAnnouncements, setClassAnnouncements] = useState([])
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementMessage, setAnnouncementMessage] = useState('')
  const [announcementLinkUrl, setAnnouncementLinkUrl] = useState('')
  const [announcementPdfFile, setAnnouncementPdfFile] = useState(null)
  const announcementPdfInputRef = useRef(null)
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)
  const [announcementFeedback, setAnnouncementFeedback] = useState(null)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [showSentAnnouncements, setShowSentAnnouncements] = useState(false)

  useEffect(() => { fetchClass() }, [classId])
  useEffect(() => { fetchStudentRoster() }, [classId])
  useEffect(() => { fetchClassAnnouncements() }, [classId])
  useEffect(() => {
    if (!selectedTerm) setHasUnsavedGradebook(false)
  }, [selectedTerm])
  useEffect(() => {
    if (selectedTerm) setSelectedAnnouncement(null)
  }, [selectedTerm])

  const fetchClass = async () => {
    const { data } = await supabase
      .from('classes')
      .select('*, users(full_name, email)')
      .eq('id', classId)
      .single()
    setCls(data)
    setLoading(false)
  }

  const fetchStudentRoster = async () => {
    const { data } = await supabase
      .from('class_students')
      .select('students(*)')
      .eq('class_id', classId)

    const list = (data || [])
      .map(row => row.students)
      .filter(Boolean)
      .sort((a, b) => (a.name_eng || '').localeCompare(b.name_eng || '', undefined, { numeric: true }))

    setStudentRoster(list)
  }

  const fetchClassAnnouncements = async () => {
    const { data } = await supabase
      .from('teacher_announcement_targets')
      .select('announcement_id, teacher_announcements(id, title, message, created_at, link_url, attachment_url, attachment_name)')
      .eq('class_id', classId)

    const rows = (data || [])
      .map((row) => row.teacher_announcements)
      .filter(Boolean)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setClassAnnouncements(rows)
  }

  const handlePostClassAnnouncement = async () => {
    setAnnouncementFeedback(null)

    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      setAnnouncementFeedback({ type: 'error', text: 'Please enter both title and message.' })
      return
    }

    setPostingAnnouncement(true)
    const linkUrl = normalizeLinkUrl(announcementLinkUrl)

    const { data: announcement, error: announcementError } = await supabase
      .from('teacher_announcements')
      .insert({
        teacher_id: profile.id,
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
        scope: 'single_class',
        link_url: linkUrl,
      })
      .select('id')
      .single()

    if (announcementError || !announcement?.id) {
      setPostingAnnouncement(false)
      setAnnouncementFeedback({
        type: 'error',
        text: `Unable to post announcement: ${announcementError?.message || 'Unknown error'}`,
      })
      return
    }

    const { error: targetError } = await supabase
      .from('teacher_announcement_targets')
      .insert({
        announcement_id: announcement.id,
        class_id: classId,
      })

    if (targetError) {
      setPostingAnnouncement(false)
      setAnnouncementFeedback({
        type: 'error',
        text: `Announcement saved, but class targeting failed: ${targetError.message}`,
      })
      return
    }

    let showAnnouncementSuccess = true

    if (announcementPdfFile) {
      const { path, displayName, error: uploadError } = await uploadTeacherAnnouncementPdf(
        announcement.id,
        announcementPdfFile
      )
      if (uploadError || !path) {
        setPostingAnnouncement(false)
        setAnnouncementFeedback({
          type: 'error',
          text: `Announcement posted, but the PDF could not be uploaded: ${uploadError?.message || 'Unknown error'}`,
        })
        setAnnouncementTitle('')
        setAnnouncementMessage('')
        setAnnouncementLinkUrl('')
        setAnnouncementPdfFile(null)
        if (announcementPdfInputRef.current) announcementPdfInputRef.current.value = ''
        await fetchClassAnnouncements()
        return
      }
      const { error: attachError } = await supabase
        .from('teacher_announcements')
        .update({ attachment_url: path, attachment_name: displayName })
        .eq('id', announcement.id)
        .eq('teacher_id', profile.id)
      if (attachError) {
        setAnnouncementFeedback({
          type: 'error',
          text: `Announcement posted, but saving the attachment failed: ${attachError.message}`,
        })
        showAnnouncementSuccess = false
      }
    }

    setPostingAnnouncement(false)

    setAnnouncementTitle('')
    setAnnouncementMessage('')
    setAnnouncementLinkUrl('')
    setAnnouncementPdfFile(null)
    if (announcementPdfInputRef.current) announcementPdfInputRef.current.value = ''
    await fetchClassAnnouncements()

    if (showAnnouncementSuccess) {
      setAnnouncementFeedback({ type: 'success', text: 'Announcement posted to this class.' })
    }
  }

  if (loading) return <Layout><div className="text-center text-gray-400 py-20">Loading...</div></Layout>
  if (!cls) return <Layout><div className="text-center text-gray-400 py-20">Class not found.</div></Layout>

  return (
    <Layout>
      <div className="mb-8">
        <button
          onClick={() => {
            const hasUnsaved = hasUnsavedGradebook || sessionStorage.getItem('gradebook_unsaved_changes') === '1'
            if (hasUnsaved) {
              const leave = window.confirm('You have unsaved gradebook changes. Please click Save before leaving this page. Continue anyway?')
              if (!leave) return
            }
            sessionStorage.setItem('gradebook_unsaved_changes', '0')
            if (selectedTerm) {
              setSelectedTerm(null)
              return
            }
            navigate(profile?.role === 'admin' ? '/admin/classes' : '/dashboard')
          }}
          className="text-sm text-white px-3 py-1.5 rounded-lg mb-4 flex items-center gap-1 transition-colors"
          style={{ backgroundColor: '#1f86c7' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#1a74ad'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#1f86c7'}
        >
          ← Go Back
        </button>
        <h2 className="text-2xl font-bold text-gray-900">{cls.name}</h2>
        <p className="text-gray-500 text-sm mt-1">
          {cls.level === 'primary' ? 'Primary' : 'Secondary'} · {cls.programme === 'bilingual' ? 'Bilingual' : 'Integrated'} · 2026-2027
        </p>
      </div>

      {!selectedTerm ? (
        <div className="space-y-10">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Student List */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Student List</h3>
                <span className="text-xs text-gray-500">{studentRoster.length} students</span>
              </div>
              {studentRoster.length === 0 ? (
                <div className="p-6 text-sm text-gray-400">No students enrolled in this class yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Student ID</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Student Name (ENG - VN)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {studentRoster.map(student => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600">{student.student_id || '—'}</td>
                          <td className="px-4 py-3 font-medium">
                            <span className="text-gray-900">{student.name_eng || '—'}</span>
                            <span className="text-gray-400 px-1">-</span>
                            <span className="text-blue-700">{student.name_vn || '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="lg:col-span-7 space-y-4">
              {/* Gradebooks Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-4" style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Gradebooks</h3>
                <div className="grid grid-cols-2 gap-4">
                  {TERMS.map(term => (
                    <button key={term.key} onClick={() => setSelectedTerm(term.key)}
                      className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:shadow-sm transition-all"
                      style={{ borderTopColor: '#9ca3af', borderTopWidth: 3 }}>
                      <div className="text-lg font-semibold text-gray-900">{term.label}</div>
                      <div className="text-sm text-gray-400 mt-1">
                        {term.weeks} weeks
                        {getTermDateSummary(term.key) ? ` · ${getTermDateSummary(term.key)}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Teacher Resources Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-4" style={{ borderTopColor: '#ffc612', borderTopWidth: 3 }}>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Teacher Resources</h3>
                <ResourceCards
                  level={cls.level}
                  grade={String(cls.name || '').trim().match(/^(\d+)/)?.[1] || null}
                  programme={cls.programme}
                  subject={cls.subject}
                />
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4" style={{ borderTopColor: '#22c55e', borderTopWidth: 3 }}>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Class Announcements</h3>
                {profile?.role === 'teacher' && profile?.id === cls.teacher_id && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <button
                        type="button"
                        onClick={() => setShowAnnouncementForm(!showAnnouncementForm)}
                        className="text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        {showAnnouncementForm ? 'Cancel' : 'Create New Announcement'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSentAnnouncements(!showSentAnnouncements)}
                        className="text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        {showSentAnnouncements ? 'Hide Announcements' : 'View Announcements'}
                      </button>
                    </div>
                    
                    {showAnnouncementForm && (
                      <div className="space-y-3 mb-4">
                        <div>
                          <label htmlFor="class-announcement-title" className="block text-xs font-medium text-gray-500 mb-1">
                            Title
                          </label>
                          <input
                            id="class-announcement-title"
                            type="text"
                            value={announcementTitle}
                            onChange={(e) => setAnnouncementTitle(e.target.value)}
                            placeholder="Short headline"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="class-announcement-message" className="block text-xs font-medium text-gray-500 mb-1">
                            Message
                          </label>
                          <textarea
                            id="class-announcement-message"
                            value={announcementMessage}
                            onChange={(e) => setAnnouncementMessage(e.target.value)}
                            placeholder="Write your class announcement..."
                            className="w-full min-h-[8rem] max-h-[min(24rem,50vh)] rounded-lg border border-gray-300 px-3 py-2 text-sm resize-y"
                          />
                        </div>
                        <div>
                          <label htmlFor="class-announcement-link" className="block text-xs font-medium text-gray-500 mb-1">
                            Link (optional)
                          </label>
                          <input
                            id="class-announcement-link"
                            type="text"
                            inputMode="url"
                            autoComplete="url"
                            value={announcementLinkUrl}
                            onChange={(e) => setAnnouncementLinkUrl(e.target.value)}
                            placeholder="e.g. Google Drive or class resource"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="class-announcement-pdf" className="block text-xs font-medium text-gray-500 mb-1">
                            PDF attachment (optional)
                          </label>
                          <input
                            id="class-announcement-pdf"
                            ref={announcementPdfInputRef}
                            type="file"
                            accept="application/pdf"
                            className="block w-full text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-sm"
                            onChange={(e) => setAnnouncementPdfFile(e.target.files?.[0] || null)}
                          />
                          {announcementPdfFile && (
                            <div className="text-xs text-gray-500 mt-1 truncate max-w-full" title={announcementPdfFile.name}>
                              {announcementPdfFile.name}
                            </div>
                          )}
                        </div>
                        {announcementFeedback && (
                          <div
                            className={`text-xs px-2 py-1 rounded border ${
                              announcementFeedback.type === 'success'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {announcementFeedback.text}
                          </div>
                        )}
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handlePostClassAnnouncement}
                            disabled={postingAnnouncement}
                            className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                          >
                            {postingAnnouncement ? 'Posting...' : 'Post Announcement'}
                          </button>
                        </div>
                      </div>
                    )}

                    {showSentAnnouncements && (
                      <div className="mt-3 border-t border-gray-200 pt-3 space-y-2 max-h-48 overflow-y-auto">
                        {classAnnouncements.length === 0 ? (
                          <div className="text-xs text-gray-500">No announcements posted yet.</div>
                        ) : (
                          classAnnouncements.slice(0, 8).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedAnnouncement(item)}
                              className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-green-50 transition-colors"
                            >
                              <div className="text-sm font-medium text-gray-800">{item.title}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{new Date(item.created_at).toLocaleDateString('en-GB')}</div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
                {profile?.role === 'admin' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {classAnnouncements.length === 0 ? (
                      <div className="sm:col-span-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        No announcements posted for this class yet.
                      </div>
                    ) : (
                      classAnnouncements.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedAnnouncement(item)}
                          className="text-left rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-green-300 hover:bg-green-50/40 transition-colors"
                        >
                          <div className="text-sm font-semibold text-gray-900 line-clamp-2">{item.title}</div>
                          <div className="text-xs text-gray-500 mt-2">
                            {new Date(item.created_at).toLocaleDateString('en-GB')}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {(profile?.role === 'admin' || (profile?.role === 'teacher' && profile?.id === cls.teacher_id)) && selectedAnnouncement && (
                <div
                  className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
                  onClick={() => setSelectedAnnouncement(null)}
                >
                  <div
                    className="w-full max-w-lg bg-white rounded-xl border border-gray-200 p-5 max-h-[min(90vh,32rem)] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900">{selectedAnnouncement.title}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(selectedAnnouncement.created_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedAnnouncement(null)}
                        className="text-gray-400 hover:text-gray-600 shrink-0"
                        aria-label="Close announcement"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-4">
                      <div className="text-xs font-medium text-gray-500">Message</div>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{selectedAnnouncement.message}</div>
                      {selectedAnnouncement.link_url && (
                        <div className="mt-4 text-xs">
                          <span className="text-gray-500 font-medium">Link</span>
                          <div className="mt-1">
                            <a
                              href={selectedAnnouncement.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline break-all"
                            >
                              {selectedAnnouncement.link_url}
                            </a>
                          </div>
                        </div>
                      )}
                      {selectedAnnouncement.attachment_url && (
                        <div className="mt-3">
                          <span className="text-xs font-medium text-gray-500 block mb-1">Attachment</span>
                          <AnnouncementPdfButton
                            storagePath={selectedAnnouncement.attachment_url}
                            fileName={selectedAnnouncement.attachment_name}
                            className="text-sm text-blue-600 hover:underline disabled:opacity-60"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      ) : (
        <Gradebook
          cls={cls}
          term={selectedTerm}
          termLabel={TERMS.find(t => t.key === selectedTerm)?.label}
          onBack={() => setSelectedTerm(null)}
          onUnsavedChange={setHasUnsavedGradebook}
        />
      )}
    </Layout>
  )
}

// ── Resource Cards ────────────────────────────────────────────────────────────
function ResourceCards({ level, grade, programme, subject }) {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchResources() }, [level, grade, programme, subject])

  const fetchResources = async () => {
    let query = supabase
      .from('resource_links')
      .select('*')
      .eq('level', level)
      .eq('programme', programme)
      .eq('subject', subject)
      .order('sort_order')

    if (grade) {
      query = query.eq('grade', grade)
    }

    const { data } = await query
    setResources(data || [])
    setLoading(false)
  }

  const TYPE_LABEL = { portal: 'Online Portal', drive: 'Google Drive', pdf: 'PDF', other: 'Link' }

  if (loading) return <div className="text-sm text-gray-400">Loading resources...</div>
  if (resources.length === 0) return (
    <div className="text-sm text-gray-400 italic">No resources added yet for this class type.</div>
  )

  return (
    <div className="grid grid-cols-2 gap-4 max-w-2xl sm:grid-cols-3">
      {resources.map(r => {
        const isComingSoon = !r.url
        return isComingSoon ? (
          <div key={r.id}
            className="rounded-xl border border-gray-200 p-5 bg-gray-50 opacity-60 cursor-not-allowed">
            <div className="font-semibold text-gray-400 text-sm">{r.title}</div>
            {r.description && <div className="text-xs text-gray-400 mt-1">{r.description}</div>}
            <div className="mt-3">
              <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-400 rounded-full">Coming Soon</span>
            </div>
          </div>
        ) : (
          <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
            className="rounded-xl border p-5 bg-white hover:shadow-md transition-all block"
            style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}>
            <div className="font-semibold text-gray-900 text-sm">{r.title}</div>
            {r.description && <div className="text-xs text-gray-500 mt-1">{r.description}</div>}
            <div className="mt-3">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                style={{ backgroundColor: '#1f86c7' }}>
                {TYPE_LABEL[r.resource_type]}
              </span>
            </div>
          </a>
        )
      })}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const pct = (score, total) => (total > 0 ? (score / total) * 100 : null)
const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
const fmt = (n) => n != null ? n.toFixed(1) : '—'
const letterGradeFromPercentage = (score) => {
  if (score == null) return '—'
  if (score >= 90.5) return 'A*'
  if (score >= 79.5) return 'A'
  if (score >= 64.5) return 'B'
  if (score >= 49.5) return 'C'
  if (score >= 34.5) return 'D'
  return 'E'
}

// ── Gradebook Shell ───────────────────────────────────────────────────────────
function Gradebook({ cls, term, termLabel, onBack, onUnsavedChange }) {
  const [activeTab, setActiveTab] = useState('participation')
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [dirtyTabs, setDirtyTabs] = useState({})
  const isESL = cls.subject === 'ESL'
  const isFinal = term === 'final_1' || term === 'final_2'

  useEffect(() => { fetchStudents() }, [cls.id])

  const fetchStudents = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('class_students')
      .select('students(*)')
      .eq('class_id', cls.id)
    const list = data?.map(d => d.students).sort((a, b) => a.name_eng.localeCompare(b.name_eng)) || []
    setStudents(list)
    setLoading(false)
  }

  const TABS = [
    { key: 'participation', label: 'Participation' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'progress_test', label: 'Progress Test' },
    { key: 'student_attributes', label: 'Student Attributes' },
    { key: 'summary', label: 'Summary' },
    ...(isFinal ? [{ key: 'comments', label: 'Comments' }] : []),
  ]

  const setTabDirty = (tabKey, isDirty) => {
    setDirtyTabs(prev => ({ ...prev, [tabKey]: isDirty }))
  }

  const hasAnyUnsaved = Object.values(dirtyTabs).some(Boolean)

  useEffect(() => {
    onUnsavedChange?.(hasAnyUnsaved)
  }, [hasAnyUnsaved, onUnsavedChange])

  useEffect(() => {
    sessionStorage.setItem('gradebook_unsaved_changes', hasAnyUnsaved ? '1' : '0')
  }, [hasAnyUnsaved])

  useEffect(() => {
    return () => {
      sessionStorage.setItem('gradebook_unsaved_changes', '0')
    }
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasAnyUnsaved) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasAnyUnsaved])

  const handleBackToTerms = () => {
    if (hasAnyUnsaved) {
      const leave = window.confirm('You have unsaved changes. Please click Save before leaving this gradebook. Continue anyway?')
      if (!leave) return
    }
    onBack()
  }

  const handleTabChange = (nextTab) => {
    if (nextTab === activeTab) return
    if (dirtyTabs[activeTab]) {
      const leave = window.confirm('You have unsaved changes in this tab. Please click Save before switching tabs. Continue anyway?')
      if (!leave) return
    }
    setActiveTab(nextTab)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{termLabel}</h3>
        <div className="flex items-center gap-3">
          {hasAnyUnsaved && (
            <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-100 text-amber-700 border border-amber-200">
              Unsaved Changes
            </span>
          )}
          <span className="text-sm text-gray-500">{students.length} students</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">Loading students...</div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No students enrolled in this class yet.
        </div>
      ) : (
        <>
          <div className="flex gap-1 border-b border-gray-200 mb-6">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'participation' && <ParticipationTab classId={cls.id} term={term} students={students} onDirtyChange={(value) => setTabDirty('participation', value)} />}
          {activeTab === 'assignments' && <AssignmentsTab classId={cls.id} term={term} students={students} onDirtyChange={(value) => setTabDirty('assignments', value)} />}
          {activeTab === 'progress_test' && <ProgressTestTab classId={cls.id} term={term} students={students} isESL={isESL} onDirtyChange={(value) => setTabDirty('progress_test', value)} />}
          {activeTab === 'student_attributes' && <StudentAttributesTab classId={cls.id} term={term} students={students} onDirtyChange={(value) => setTabDirty('student_attributes', value)} />}
          {activeTab === 'summary' && <SummaryTab classId={cls.id} term={term} students={students} isESL={isESL} />}
          {activeTab === 'comments' && isFinal && <CommentsTab classId={cls.id} term={term} students={students} onDirtyChange={(value) => setTabDirty('comments', value)} />}
        </>
      )}
    </div>
  )
}

// ── Participation Tab ─────────────────────────────────────────────────────────
function ParticipationTab({ classId, term, students, onDirtyChange }) {
  const [grades, setGrades] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [openCommentKey, setOpenCommentKey] = useState(null)
  const [draftComment, setDraftComment] = useState('')

  useEffect(() => { fetchGrades() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term])

  const fetchGrades = async () => {
    const { data } = await supabase
      .from('participation_grades')
      .select('*')
      .eq('class_id', classId)
      .eq('term', term)
    const map = {}
    data?.forEach(g => { map[`${g.student_id}_${g.week}`] = { score: g.score, comment: g.comment } })
    setGrades(map)
  }

  const setGrade = (studentId, week, field, value) => {
    onDirtyChange?.(true)
    setGrades(prev => ({ ...prev, [`${studentId}_${week}`]: { ...prev[`${studentId}_${week}`], [field]: value } }))
  }

  const openCommentEditor = (key) => {
    setOpenCommentKey(key)
    setDraftComment(grades[key]?.comment ?? '')
  }

  const saveComment = (studentId, week) => {
    setGrade(studentId, week, 'comment', draftComment)
    setOpenCommentKey(null)
    setDraftComment('')
  }

  const saveAll = async () => {
    setSaving(true)
    const rows = []
    weekSchedule.forEach(({ week, isNoScore }) => {
      if (isNoScore) return
      students.forEach(student => {
        const key = `${student.id}_${week}`
        const g = grades[key]
        const hasTouchedScore = g?.score !== undefined
        const hasTouchedComment = g?.comment !== undefined
        if (!hasTouchedScore && !hasTouchedComment) return

        const parsedScore = g?.score === '' || g?.score == null ? null : parseFloat(g.score)
        rows.push({
          class_id: classId,
          student_id: student.id,
          term,
          week,
          score: Number.isNaN(parsedScore) ? null : parsedScore,
          comment: g?.comment || null,
        })
      })
    })
    await supabase.from('participation_grades').upsert(rows, { onConflict: 'class_id,student_id,term,week' })
    setSaving(false)
    setSaved(true)
    onDirtyChange?.(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const getAvg = (studentId) => {
    const scores = weekSchedule
      .filter(w => !w.isNoScore)
      .map(w => grades[`${studentId}_${w.week}`]?.score)
      .filter(s => s !== undefined && s !== '' && s !== null)
      .map(Number)
    const average = avg(scores)
    return average != null ? average * 10 : null
  }

  const weekSchedule = PARTICIPATION_WEEK_SCHEDULE[term] || Array.from({ length: 7 }, (_, idx) => ({
    week: idx + 1,
    label: `Week ${idx + 1}`,
    range: 'Date TBD',
  }))

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Weekly participation scores out of 10.</p>
        <button onClick={saveAll} disabled={saving}
          className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300">
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-48">Student</th>
              {weekSchedule.map((weekItem) => (
                <th key={weekItem.week} className="text-center px-2 py-3 font-medium min-w-28 bg-gray-200 text-gray-700">
                  <div>{weekItem.label}</div>
                  <div className="text-[10px] text-gray-400 font-normal mt-0.5">{weekItem.range}</div>
                  {weekItem.isNoScore && (
                    <div className="text-[10px] text-rose-600 font-semibold mt-0.5">No Score</div>
                  )}
                </th>
              ))}
              <th className="text-center px-4 py-3 font-medium min-w-20 bg-green-100 text-green-800">Participation - Overall</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map(student => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 sticky left-0 bg-white">
                  <div className="font-medium">
                    <span className="text-gray-900">{student.name_eng || '—'}</span>
                    <span className="text-gray-400 px-1">-</span>
                    <span className="text-blue-700">{student.name_vn || '—'}</span>
                  </div>
                  <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                </td>
                {weekSchedule.map((weekItem) => {
                  const key = `${student.id}_${weekItem.week}`
                  const isNoScoreWeek = !!weekItem.isNoScore
                  return (
                    <td key={weekItem.week} className="px-2 py-2 bg-gray-50">
                      {isNoScoreWeek ? (
                        <div className="flex items-center justify-center h-[52px]">
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-semibold">
                            {weekItem.noScoreReason || 'No Score Week'}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <input type="number" min="0" max="10" step="0.5" placeholder="—"
                            value={grades[key]?.score ?? ''}
                            onChange={e => setGrade(student.id, weekItem.week, 'score', e.target.value)}
                            className="w-14 text-center border border-gray-200 rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1 block mx-auto"
                          />
                          {openCommentKey === key ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                placeholder="Type comment"
                                value={draftComment}
                                onChange={e => setDraftComment(e.target.value)}
                                className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveComment(student.id, weekItem.week)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCommentKey(null)
                                    setDraftComment('')
                                  }}
                                  className="text-[10px] text-gray-400 hover:text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCommentEditor(key)}
                              className={`block mx-auto text-[10px] px-1.5 py-0.5 rounded border ${
                                grades[key]?.comment
                                  ? 'border-blue-200 bg-blue-50 text-blue-600'
                                  : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {grades[key]?.comment ? 'Edit Comment' : 'Add Comment'}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center bg-green-50">
                  <span className={`font-semibold ${
                    getAvg(student.id) != null 
                      ? getAvg(student.id) >= 80 ? 'text-green-600' 
                      : getAvg(student.id) >= 65 ? 'text-blue-600'
                      : getAvg(student.id) >= 50 ? 'text-amber-600'
                      : 'text-red-600'
                      : 'text-gray-300'
                  }`}>
                    {getAvg(student.id) != null ? fmt(getAvg(student.id)) : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Assignments Tab ───────────────────────────────────────────────────────────
function AssignmentsTab({ classId, term, students, onDirtyChange }) {
  const [assignments, setAssignments] = useState([])
  const [grades, setGrades] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [newAssignment, setNewAssignment] = useState({ name: '', max_points: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [openCommentKey, setOpenCommentKey] = useState(null)
  const [draftComment, setDraftComment] = useState('')
  const [deletingAssignmentId, setDeletingAssignmentId] = useState(null)
  const [confirmDeleteAssignment, setConfirmDeleteAssignment] = useState(null)

  useEffect(() => { fetchAssignments() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term])

  const fetchAssignments = async () => {
    const { data: aData } = await supabase.from('assignments').select('*').eq('class_id', classId).eq('term', term).order('created_at')
    setAssignments(aData || [])
    if (aData?.length) {
      const { data: gData } = await supabase.from('assignment_grades').select('*').in('assignment_id', aData.map(a => a.id))
      const map = {}
      gData?.forEach(g => { map[`${g.assignment_id}_${g.student_id}`] = { score: g.score, is_absent: g.is_absent, comment: g.comment } })
      setGrades(map)
    }
  }

  const createAssignment = async () => {
    if (!newAssignment.name || !newAssignment.max_points) return
    const { data } = await supabase.from('assignments').insert({ class_id: classId, term, name: newAssignment.name, max_points: parseFloat(newAssignment.max_points) }).select().single()
    setAssignments(prev => [...prev, data])
    setNewAssignment({ name: '', max_points: '' })
    setShowForm(false)
  }

  const deleteAssignment = async (assignment) => {
    setDeletingAssignmentId(assignment.id)
    await supabase.from('assignment_grades').delete().eq('assignment_id', assignment.id)
    await supabase.from('assignments').delete().eq('id', assignment.id)

    setAssignments(prev => prev.filter(a => a.id !== assignment.id))
    setGrades(prev => {
      const next = { ...prev }
      students.forEach(student => {
        delete next[`${assignment.id}_${student.id}`]
      })
      return next
    })
    setConfirmDeleteAssignment(null)
    setDeletingAssignmentId(null)
  }

  const setGrade = (assignmentId, studentId, field, value) => {
    onDirtyChange?.(true)
    setGrades(prev => ({ ...prev, [`${assignmentId}_${studentId}`]: { ...prev[`${assignmentId}_${studentId}`], [field]: value } }))
  }

  const openCommentEditor = (key) => {
    setOpenCommentKey(key)
    setDraftComment(grades[key]?.comment ?? '')
  }

  const saveComment = (assignmentId, studentId) => {
    setGrade(assignmentId, studentId, 'comment', draftComment)
    setOpenCommentKey(null)
    setDraftComment('')
  }

  const getStudentAvg = (studentId) => {
    const pcts = assignments.map(a => {
      const g = grades[`${a.id}_${studentId}`]
      if (!g || g.is_absent || g.score === '' || g.score == null) return null
      return pct(parseFloat(g.score), a.max_points)
    }).filter(p => p !== null)
    return avg(pcts)
  }

  const saveAll = async () => {
    setSaving(true)
    const rows = []
    assignments.forEach(assignment => {
      students.forEach(student => {
        const key = `${assignment.id}_${student.id}`
        const g = grades[key]
        if (g !== undefined) {
          rows.push({
            assignment_id: assignment.id,
            student_id: student.id,
            score: g.is_absent ? null : (g.score !== '' ? parseFloat(g.score) : null),
            is_absent: g.is_absent || false,
            comment: g.comment ? g.comment.trim() : null,
          })
        }
      })
    })
    await supabase.from('assignment_grades').upsert(rows, { onConflict: 'assignment_id,student_id' })
    setSaving(false)
    setSaved(true)
    onDirtyChange?.(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Create assignments and enter student scores. Absent students are excluded from averages.</p>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            + New Assignment
          </button>
          {assignments.length > 0 && (
            <button onClick={saveAll} disabled={saving} className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300">
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Assignment Name</label>
            <input type="text" placeholder="e.g. Essay 1" value={newAssignment.name}
              onChange={e => setNewAssignment({ ...newAssignment, name: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Total Points</label>
            <input type="number" placeholder="100" value={newAssignment.max_points}
              onChange={e => setNewAssignment({ ...newAssignment, max_points: e.target.value })}
              className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={createAssignment} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Create</button>
          <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
        </div>
      )}

      {confirmDeleteAssignment && (
        <div className="mb-4 px-4 py-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-700 mb-3">
            Delete <strong>{confirmDeleteAssignment.name}</strong>? This will remove all student scores for this assignment.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => deleteAssignment(confirmDeleteAssignment)}
              disabled={deletingAssignmentId === confirmDeleteAssignment.id}
              className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:bg-gray-300"
            >
              {deletingAssignmentId === confirmDeleteAssignment.id ? 'Deleting...' : 'Yes, delete assignment'}
            </button>
            <button
              onClick={() => setConfirmDeleteAssignment(null)}
              disabled={deletingAssignmentId === confirmDeleteAssignment.id}
              className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No assignments yet. Create one to get started.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-48">Student</th>
                {assignments.map(a => (
                  <th key={a.id} className="text-center px-3 py-3 font-medium min-w-32 bg-gray-200 text-gray-700">
                    <div className="flex items-center justify-center gap-2">
                      <span>{a.name}</span>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAssignment(a)}
                        disabled={deletingAssignmentId === a.id}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-red-200 text-red-500 text-xs leading-none hover:bg-red-50 disabled:opacity-50"
                        title={`Delete ${a.name}`}
                        aria-label={`Delete ${a.name}`}
                      >
                        {deletingAssignmentId === a.id ? '…' : '×'}
                      </button>
                    </div>
                    <div className="text-xs font-normal text-gray-400">/ {a.max_points}</div>
                  </th>
                ))}
                <th className="text-center px-4 py-3 font-medium min-w-24 bg-green-100 text-green-800">Assignments - Overall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map(student => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 sticky left-0 bg-white">
                    <div className="font-medium">
                      <span className="text-gray-900">{student.name_eng || '—'}</span>
                      <span className="text-gray-400 px-1">-</span>
                      <span className="text-blue-700">{student.name_vn || '—'}</span>
                    </div>
                    <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                  </td>
                  {assignments.map(assignment => {
                    const key = `${assignment.id}_${student.id}`
                    const g = grades[key] || {}
                    return (
                      <td key={assignment.id} className="px-3 py-2 text-center bg-gray-50">
                        {g.is_absent ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded text-xs font-medium">Absent</span>
                            <button onClick={() => setGrade(assignment.id, student.id, 'is_absent', false)} className="text-xs text-gray-400 hover:text-gray-600">undo</button>
                            {openCommentKey === key ? (
                              <div className="w-full space-y-1">
                                <input
                                  type="text"
                                  placeholder="Type comment"
                                  value={draftComment}
                                  onChange={e => setDraftComment(e.target.value)}
                                  className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => saveComment(assignment.id, student.id)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenCommentKey(null)
                                      setDraftComment('')
                                    }}
                                    className="text-[10px] text-gray-400 hover:text-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openCommentEditor(key)}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  g.comment
                                    ? 'border-blue-200 bg-blue-50 text-blue-600'
                                    : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {g.comment ? 'Edit Comment' : 'Add Comment'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <input type="number" min="0" max={assignment.max_points} placeholder="—"
                              value={g.score ?? ''}
                              onChange={e => setGrade(assignment.id, student.id, 'score', e.target.value)}
                              className="w-16 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button onClick={() => setGrade(assignment.id, student.id, 'is_absent', true)} className="text-xs text-gray-400 hover:text-orange-500">A (absent)</button>
                            {openCommentKey === key ? (
                              <div className="w-full space-y-1">
                                <input
                                  type="text"
                                  placeholder="Type comment"
                                  value={draftComment}
                                  onChange={e => setDraftComment(e.target.value)}
                                  className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => saveComment(assignment.id, student.id)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenCommentKey(null)
                                      setDraftComment('')
                                    }}
                                    className="text-[10px] text-gray-400 hover:text-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openCommentEditor(key)}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  g.comment
                                    ? 'border-blue-200 bg-blue-50 text-blue-600'
                                    : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {g.comment ? 'Edit Comment' : 'Add Comment'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center bg-green-50">
                    <span className={`font-semibold ${getStudentAvg(student.id) != null ? 'text-blue-600' : 'text-gray-300'}`}>
                      {fmt(getStudentAvg(student.id))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Progress Test Tab ─────────────────────────────────────────────────────────
function ProgressTestTab({ classId, term, students, isESL, onDirtyChange }) {
  const [grades, setGrades] = useState({})
  const [totals, setTotals] = useState(
    isESL
      ? { rw_total: '', l_total: '', s_total: '' }
      : { total_points: '' }
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [openCommentStudentId, setOpenCommentStudentId] = useState(null)
  const [draftComment, setDraftComment] = useState('')

  useEffect(() => { fetchGrades() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term, isESL])

  const fetchGrades = async () => {
    const { data } = await supabase.from('progress_test_grades').select('*').eq('class_id', classId).eq('term', term)
    const map = {}
    data?.forEach(g => {
      map[g.student_id] = isESL
        ? { rw: g.reading_writing_score, l: g.listening_score, s: g.speaking_score, comment: g.comment }
        : { score: g.score, comment: g.comment }
      if (isESL && data[0]) {
        setTotals({ rw_total: data[0].reading_writing_total || '', l_total: data[0].listening_total || '', s_total: data[0].speaking_total || '' })
      } else if (!isESL && data[0]) {
        setTotals({ total_points: data[0].total_points || '' })
      }
    })
    setGrades(map)
  }

  const setGrade = (studentId, field, value) => {
    onDirtyChange?.(true)
    setGrades(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }))
  }

  const openCommentEditor = (studentId) => {
    setOpenCommentStudentId(studentId)
    setDraftComment(grades[studentId]?.comment ?? '')
  }

  const saveComment = (studentId) => {
    setGrade(studentId, 'comment', draftComment)
    setOpenCommentStudentId(null)
    setDraftComment('')
  }

  const getOverall = (studentId) => {
    const g = grades[studentId]
    if (!g) return null
    if (isESL) {
      const rwPct = totals.rw_total && g.rw !== '' && g.rw != null ? pct(parseFloat(g.rw), parseFloat(totals.rw_total)) : null
      const lPct = totals.l_total && g.l !== '' && g.l != null ? pct(parseFloat(g.l), parseFloat(totals.l_total)) : null
      const sPct = totals.s_total && g.s !== '' && g.s != null ? pct(parseFloat(g.s), parseFloat(totals.s_total)) : null
      const valid = [rwPct, lPct, sPct].filter(p => p !== null)
      return valid.length === 3 ? avg(valid) : null
    } else {
      return totals.total_points && g.score !== '' && g.score != null ? pct(parseFloat(g.score), parseFloat(totals.total_points)) : null
    }
  }

  const saveAll = async () => {
    setSaving(true)
    const rows = students.map(student => {
      const g = grades[student.id] || {}
      const overall = getOverall(student.id)
      if (isESL) {
        return {
          class_id: classId, student_id: student.id, term,
          reading_writing_score: g.rw != null && g.rw !== '' ? parseFloat(g.rw) : null,
          reading_writing_total: totals.rw_total ? parseFloat(totals.rw_total) : null,
          listening_score: g.l != null && g.l !== '' ? parseFloat(g.l) : null,
          listening_total: totals.l_total ? parseFloat(totals.l_total) : null,
          speaking_score: g.s != null && g.s !== '' ? parseFloat(g.s) : null,
          speaking_total: totals.s_total ? parseFloat(totals.s_total) : null,
          overall_percentage: overall,
          comment: g.comment ? g.comment.trim() : null,
        }
      } else {
        return {
          class_id: classId, student_id: student.id, term,
          score: g.score != null && g.score !== '' ? parseFloat(g.score) : null,
          total_points: totals.total_points ? parseFloat(totals.total_points) : null,
          overall_percentage: overall,
          comment: g.comment ? g.comment.trim() : null,
        }
      }
    })
    await supabase.from('progress_test_grades').upsert(rows, { onConflict: 'class_id,student_id,term' })
    setSaving(false)
    setSaved(true)
    onDirtyChange?.(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">
          {isESL ? 'Enter total points for each component, then student scores.' : 'Enter total points for the test, then student scores.'}
        </p>
        <button onClick={saveAll} disabled={saving} className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300">
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex gap-6 items-end">
        {isESL ? (
          <>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Reading & Writing — Total Points</label>
              <input type="number" placeholder="e.g. 50" value={totals.rw_total}
                onChange={e => {
                  onDirtyChange?.(true)
                  setTotals(prev => ({ ...prev, rw_total: e.target.value }))
                }}
                className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Listening — Total Points</label>
              <input type="number" placeholder="e.g. 40" value={totals.l_total}
                onChange={e => {
                  onDirtyChange?.(true)
                  setTotals(prev => ({ ...prev, l_total: e.target.value }))
                }}
                className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Speaking — Total Points</label>
              <input type="number" placeholder="e.g. 10" value={totals.s_total}
                onChange={e => {
                  onDirtyChange?.(true)
                  setTotals(prev => ({ ...prev, s_total: e.target.value }))
                }}
                className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </>
        ) : (
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Total Points</label>
            <input type="number" placeholder="e.g. 100" value={totals.total_points}
              onChange={e => {
                onDirtyChange?.(true)
                setTotals(prev => ({ ...prev, total_points: e.target.value }))
              }}
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-48">Student</th>
              {isESL ? (
                <>
                  <th className="text-center px-3 py-3 font-medium min-w-36 bg-gray-200 text-gray-700">Progress Test - Reading & Writing</th>
                  <th className="text-center px-3 py-3 font-medium min-w-32 bg-gray-200 text-gray-700">Progress Test - Listening</th>
                  <th className="text-center px-3 py-3 font-medium min-w-32 bg-gray-200 text-gray-700">Progress Test - Speaking</th>
                </>
              ) : (
                <th className="text-center px-3 py-3 text-gray-500 font-medium min-w-32">Score {totals.total_points ? `/ ${totals.total_points}` : ''}</th>
              )}
                <th className="text-center px-4 py-3 font-medium min-w-24 bg-green-100 text-green-800">Progress Test - Overall</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map(student => {
              const g = grades[student.id] || {}
              const overall = getOverall(student.id)
              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 sticky left-0 bg-white">
                    <div className="font-medium">
                      <span className="text-gray-900">{student.name_eng || '—'}</span>
                      <span className="text-gray-400 px-1">-</span>
                      <span className="text-blue-700">{student.name_vn || '—'}</span>
                    </div>
                    <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                  </td>
                  {isESL ? (
                    <>
                      <td className="px-3 py-2 text-center bg-gray-50">
                        <div className="flex flex-col items-center gap-1">
                          <input type="number" min="0" max={totals.rw_total || undefined} placeholder="—"
                            value={g.rw ?? ''}
                            onChange={e => setGrade(student.id, 'rw', e.target.value)}
                            className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          {openCommentStudentId === student.id ? (
                            <div className="w-full space-y-1">
                              <input
                                type="text"
                                placeholder="Type comment"
                                value={draftComment}
                                onChange={e => setDraftComment(e.target.value)}
                                className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveComment(student.id)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCommentStudentId(null)
                                    setDraftComment('')
                                  }}
                                  className="text-[10px] text-gray-400 hover:text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCommentEditor(student.id)}
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                g.comment
                                  ? 'border-blue-200 bg-blue-50 text-blue-600'
                                  : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {g.comment ? 'Edit Comment' : 'Add Comment'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" min="0" max={totals.l_total || undefined} placeholder="—"
                          value={g.l ?? ''}
                          onChange={e => setGrade(student.id, 'l', e.target.value)}
                          className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" min="0" max={totals.s_total || undefined} placeholder="—"
                          value={g.s ?? ''}
                          onChange={e => setGrade(student.id, 's', e.target.value)}
                          className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </td>
                    </>
                  ) : (
                    <td className="px-3 py-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <input type="number" min="0" max={totals.total_points || undefined} placeholder="—"
                          value={g.score ?? ''}
                          onChange={e => setGrade(student.id, 'score', e.target.value)}
                          className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        {openCommentStudentId === student.id ? (
                          <div className="w-full space-y-1">
                            <input
                              type="text"
                              placeholder="Type comment"
                              value={draftComment}
                              onChange={e => setDraftComment(e.target.value)}
                              className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => saveComment(student.id)}
                                className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenCommentStudentId(null)
                                  setDraftComment('')
                                }}
                                className="text-[10px] text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCommentEditor(student.id)}
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              g.comment
                                ? 'border-blue-200 bg-blue-50 text-blue-600'
                                : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {g.comment ? 'Edit Comment' : 'Add Comment'}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3 text-center bg-green-50">
                    <span className={`font-semibold ${overall != null ? 'text-blue-600' : 'text-gray-300'}`}>
                      {fmt(overall)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Student Attributes Tab ────────────────────────────────────────────────────
function StudentAttributesTab({ classId, term, students, onDirtyChange }) {
  const [attributes, setAttributes] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const ATTRIBUTE_FIELDS = [
    { key: 'confident', label: 'Confident' },
    { key: 'responsible', label: 'Responsible' },
    { key: 'reflective', label: 'Reflective' },
    { key: 'innovative', label: 'Innovative' },
    { key: 'engaged', label: 'Engaged' },
  ]

  const OPTIONS = [
    { value: '', label: '—' },
    { value: 'G', label: 'G - Good' },
    { value: 'S', label: 'S - Satisfactory' },
    { value: 'N', label: 'N - Needs Improvement' },
  ]

  useEffect(() => { fetchAttributes() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term])

  const fetchAttributes = async () => {
    const { data } = await supabase
      .from('student_attributes')
      .select('*')
      .eq('class_id', classId)
      .eq('term', term)

    const map = {}
    data?.forEach((row) => {
      map[row.student_id] = {
        confident: row.confident || '',
        responsible: row.responsible || '',
        reflective: row.reflective || '',
        innovative: row.innovative || '',
        engaged: row.engaged || '',
      }
    })
    setAttributes(map)
  }

  const setAttribute = (studentId, field, value) => {
    onDirtyChange?.(true)
    setAttributes(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }))
  }

  const saveAll = async () => {
    setSaving(true)
    const rows = students.map((student) => {
      const values = attributes[student.id] || {}
      return {
        class_id: classId,
        student_id: student.id,
        term,
        confident: values.confident || null,
        responsible: values.responsible || null,
        reflective: values.reflective || null,
        innovative: values.innovative || null,
        engaged: values.engaged || null,
      }
    })

    await supabase
      .from('student_attributes')
      .upsert(rows, { onConflict: 'class_id,student_id,term' })

    setSaving(false)
    setSaved(true)
    onDirtyChange?.(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Set G/S/N for each student attribute criterion.</p>
        <button
          onClick={saveAll}
          disabled={saving}
          className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-48">Student</th>
              {ATTRIBUTE_FIELDS.map(field => (
                <th key={field.key} className="text-center px-3 py-3 text-gray-500 font-medium min-w-44 border-l border-gray-100">
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((student) => {
              const row = attributes[student.id] || {}
              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 sticky left-0 bg-white">
                    <div className="font-medium">
                      <span className="text-gray-900">{student.name_eng || '—'}</span>
                      <span className="text-gray-400 px-1">-</span>
                      <span className="text-blue-700">{student.name_vn || '—'}</span>
                    </div>
                    <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                  </td>
                  {ATTRIBUTE_FIELDS.map(field => (
                    <td key={field.key} className="px-3 py-2 text-center border-l border-gray-100">
                      <select
                        value={row[field.key] ?? ''}
                        onChange={e => setAttribute(student.id, field.key, e.target.value)}
                        className="w-40 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {OPTIONS.map(option => (
                          <option key={`${field.key}_${option.value || 'empty'}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Summary Tab ───────────────────────────────────────────────────────────────
function SummaryTab({ classId, term, students, isESL }) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [classId, term])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: partData }, { data: assignData }, { data: assignGrades }, { data: ptData }] = await Promise.all([
      supabase.from('participation_grades').select('*').eq('class_id', classId).eq('term', term),
      supabase.from('assignments').select('*').eq('class_id', classId).eq('term', term),
      supabase.from('assignment_grades').select('*'),
      supabase.from('progress_test_grades').select('*').eq('class_id', classId).eq('term', term),
    ])

    const summary = {}
    students.forEach(student => {
      const partScores = partData?.filter(g => g.student_id === student.id && g.score != null).map(g => g.score) || []
      const partAvg = avg(partScores)
      const partPct = partAvg != null ? (partAvg / 10) * 100 : null

      const assignPcts = assignData?.map(a => {
        const g = assignGrades?.find(g => g.assignment_id === a.id && g.student_id === student.id)
        if (!g || g.is_absent || g.score == null) return null
        return pct(g.score, a.max_points)
      }).filter(p => p !== null) || []
      const assignAvg = avg(assignPcts)

      const attainment = partPct != null && assignAvg != null
        ? (partPct * 0.20) + (assignAvg * 0.80)
        : partPct != null ? partPct * 0.20
        : assignAvg != null ? assignAvg * 0.80
        : null

      const pt = ptData?.find(g => g.student_id === student.id)
      const ptOverall = pt?.overall_percentage ?? null

      const total = attainment != null && ptOverall != null
        ? (attainment * 0.75) + (ptOverall * 0.25)
        : null

      summary[student.id] = { partPct, assignAvg, attainment, ptOverall, total }
    })

    setData(summary)
    setLoading(false)
  }

  const scoreColor = (score) => {
    if (score == null) return 'text-gray-300'
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-blue-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">
          Auto-calculated. Attainment = Participation (20%) + Assignments (80%). Total = Attainment (75%) + Progress Test (25%).
        </p>
        <button onClick={fetchAll} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          ↻ Refresh
        </button>
      </div>
      {loading ? (
        <div className="text-center text-gray-400 py-10">Calculating...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-48">Student</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Participation %</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Assignments %</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium bg-blue-50">Attainment %</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Progress Test %</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium bg-green-50">Total %</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Letter Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map(student => {
                const d = data[student.id] || {}
                return (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 sticky left-0 bg-white">
                      <div className="font-medium">
                        <span className="text-gray-900">{student.name_eng || '—'}</span>
                        <span className="text-gray-400 px-1">-</span>
                        <span className="text-blue-700">{student.name_vn || '—'}</span>
                      </div>
                      <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                    </td>
                    <td className={`px-4 py-3 text-center font-medium ${scoreColor(d.partPct)}`}>{fmt(d.partPct)}{d.partPct != null ? '%' : ''}</td>
                    <td className={`px-4 py-3 text-center font-medium ${scoreColor(d.assignAvg)}`}>{fmt(d.assignAvg)}{d.assignAvg != null ? '%' : ''}</td>
                    <td className={`px-4 py-3 text-center font-semibold bg-blue-50 ${scoreColor(d.attainment)}`}>{fmt(d.attainment)}{d.attainment != null ? '%' : ''}</td>
                    <td className={`px-4 py-3 text-center font-medium ${scoreColor(d.ptOverall)}`}>{fmt(d.ptOverall)}{d.ptOverall != null ? '%' : ''}</td>
                    <td className={`px-4 py-3 text-center font-bold bg-green-50 ${scoreColor(d.total)}`}>{fmt(d.total)}{d.total != null ? '%' : ''}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-gray-800">{letterGradeFromPercentage(d.total)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Comments Tab ──────────────────────────────────────────────────────────────
function CommentsTab({ classId, term, students, onDirtyChange }) {
  const [comments, setComments] = useState({})
  const [originalComments, setOriginalComments] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingStudentId, setEditingStudentId] = useState(null)

  useEffect(() => { fetchComments() }, [classId, term])
  useEffect(() => { 
    const hasChanges = Object.entries(comments).some(([id, val]) => originalComments[id] !== val)
    onDirtyChange?.(hasChanges) 
  }, [comments, originalComments])

  const fetchComments = async () => {
    const { data } = await supabase.from('term_comments').select('*').eq('class_id', classId).eq('term', term)
    const map = {}
    const original = {}
    data?.forEach(c => { 
      map[c.student_id] = c.comment 
      original[c.student_id] = c.comment
    })
    setComments(map)
    setOriginalComments(original)
  }

  const saveComment = async (studentId) => {
    setSaving(true)
    
    await supabase.from('term_comments').upsert({
      class_id: classId,
      student_id: studentId,
      term,
      comment: comments[studentId]?.trim() || null
    }, { onConflict: 'class_id,student_id,term' })
    
    setOriginalComments(prev => ({ ...prev, [studentId]: comments[studentId] }))
    setSaving(false)
    setSaved(true)
    setEditingStudentId(null)
    
    setTimeout(() => setSaved(false), 2000)
  }

  const cancelEdit = (studentId) => {
    setComments(prev => ({ ...prev, [studentId]: originalComments[studentId] ?? '' }))
    setEditingStudentId(null)
  }

  const isDirty = (studentId) => {
    return comments[studentId] !== originalComments[studentId]
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Write end of term comments for each student. Click box to expand.</p>
        {saved && <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">✓ Saved</span>}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 w-64 min-w-64">Student</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Comment</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium w-28 min-w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map(student => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 sticky left-0 bg-white">
                  <div className="font-medium">
                    <span className="text-gray-900">{student.name_eng || '—'}</span>
                    <span className="text-gray-400 px-1">-</span>
                    <span className="text-blue-700">{student.name_vn || '—'}</span>
                  </div>
                  <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <textarea 
                    rows={editingStudentId === student.id ? 4 : 1} 
                    placeholder="Write a comment for this student..."
                    value={comments[student.id] ?? ''}
                    onChange={e => {
                      setComments(prev => ({ ...prev, [student.id]: e.target.value }))
                    }}
                    onFocus={() => setEditingStudentId(student.id)}
                    onBlur={() => !isDirty(student.id) && setEditingStudentId(null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {isDirty(student.id) && (
                      <>
                        <button 
                          onClick={() => saveComment(student.id)} 
                          disabled={saving}
                          className="px-3 py-1 text-xs rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button 
                          onClick={() => cancelEdit(student.id)}
                          className="px-3 py-1 text-xs rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {!isDirty(student.id) && editingStudentId !== student.id && (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
