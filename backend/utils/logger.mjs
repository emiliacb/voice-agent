export class Log {
  static #template(level, message) {
    const formatedDate = new Date().toISOString().replace('T', ' ').replace('Z', '');
    return `[${formatedDate}] ${level} ${message}`;
  }

  static info(message) {
    console.log(Log.#template('INFO', message));
  }

  static error(message) {
    console.error(Log.#template('ERROR', message));
  }
} 