import * as core from '@actions/core'

const CLICKUP_TOKEN = core.getInput('CLICKUP_TOKEN')
const LIST_ID = core.getInput('LIST_ID')
let MESSAGE = core.getInput('MESSAGE')
const ASSIGNEES = core.getInput('ASSIGNEES')
const FIELDS = core.getInput('FIELDS')
const AUTHOR = core.getInput('AUTHOR')
const STATUS = core.getInput('TASK_STATUS') || 'DONE'
const CLICKUP_API = 'https://api.clickup.com/api/v2'

const assignee = () => {
  try {
    const base64String = atob(ASSIGNEES)
    const assignees: any[] = JSON.parse(base64String)
    return assignees.find(({ user }) => user == AUTHOR)?.id
  } catch (e) {
    return null
  }
}
const customFieldsSecret = () => {
  try {
    const fields = atob(FIELDS)
    const parsedFields = JSON.parse(fields)
    if (Array.isArray(parsedFields)) return parsedFields
    return []
  } catch (e) {
    return []
  }
}

const milliseconds = () => {
  const minMilliseconds = 20 * 60 * 1000 // 20 minutes
  const maxMilliseconds = 2 * 60 * 60 * 1000 // 3 hours
  return (
    Math.floor(Math.random() * (maxMilliseconds - minMilliseconds + 1)) +
    minMilliseconds
  )
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export const run = async (): Promise<void> => {
  const author = assignee()
  const customFields = customFieldsSecret()
  if (author) {
    console.log(`✅ CREATING TASK FOR:: ${author} ✅`)
    try {
      if (MESSAGE.includes(':')) {
        MESSAGE = MESSAGE.split(':')[1]
      }
      const body = JSON.stringify({
        name: MESSAGE,
        description: MESSAGE,
        markdown_description: MESSAGE,
        assignees: [author],
        status: STATUS,
        priority: 2,
        due_date: new Date().valueOf(),
        due_date_time: false,
        customFields,
        time_estimate: milliseconds(),
        start_date: Date.now() - 2 * 60 * 60 * 1000,
        start_date_time: false
      })

      const headers = new Headers()
      headers.append('Content-Type', 'application/json')
      headers.append('Authorization', CLICKUP_TOKEN)

      let response = await fetch(`${CLICKUP_API}/list/${LIST_ID}/task`, {
        method: 'POST',
        headers: headers,
        body
      })
      const res = await response.json()

      if (res?.id && customFields.length) {
        for (const customField of customFields) {
          if (customField.id) {
            await fetch(
              `${CLICKUP_API}/task/${res.id}/field/${customField?.id}`,
              {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(
                  customField.value && typeof customField.value !== 'string'
                    ? { value: customField.value }
                    : customField
                )
              }
            )
          }
        }
      }

      if (res.err) {
        console.log(`🚫 FAILED TO CREATE TASK:: ${res.err} 🚫`)
      }
      // Set outputs for other workflow steps to use
      core.setOutput('time', new Date().toTimeString())
    } catch (error: any) {
      console.log(`🚫 TASK FAILED WITH ERROR : ${error?.message} 🚫`)
      // Fail the workflow run if an error occurs
      if (error instanceof Error) core.setFailed(error.message)
    }
    return
  }
  console.log('❌ USER NOT SET ❌')
}
