export class TaskManager {
  constructor() {
    this.tasks = new Map()
  }

  createTask(type, params) {
    const taskId = Date.now().toString(36) + Math.random().toString(36).substr(2)
    const task = {
      id: taskId,
      type,
      params,
      status: 'pending',
      progress: 0,
      message: '',
      result: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.tasks.set(taskId, task)
    return task
  }

  updateTask(taskId, updates) {
    const task = this.tasks.get(taskId)
    if (task) {
      Object.assign(task, updates)
      task.updatedAt = new Date()
    }
    return task
  }

  getTask(taskId) {
    return this.tasks.get(taskId) || null
  }

  getAllTasks() {
    return Array.from(this.tasks.values())
  }

  removeTask(taskId) {
    this.tasks.delete(taskId)
  }

  async executeTask(taskId, executor) {
    const task = this.getTask(taskId)
    if (!task) return

    try {
      this.updateTask(taskId, { status: 'running', progress: 0 })
      await executor(taskId, (progress, message) => {
        this.updateTask(taskId, { progress, message })
      })
    } catch (error) {
      this.updateTask(taskId, {
        status: 'failed',
        progress: 100,
        message: error.message,
      })
    }
  }
}

export const taskManager = new TaskManager()