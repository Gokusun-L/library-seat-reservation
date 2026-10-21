/**
 * 统一错误码表
 * 约定：HTTP 状态码表达「大类」（400 参数类 / 403 权限 / 404 不存在 / 409 冲突），
 *      body.code 表达「具体原因」，前端只需要判断 code 就能给出精确提示。
 * 交接说明：第二棒新增接口时，只能在 5xxxx（签到/履约）段追加，不要改动已有编号。
 */
const ERROR_CODE = {
  // ---- 成功 ----
  OK: 0,

  // ---- 4xxxx 客户端错误：参数与资源 ----
  PARAM_MISSING: 40001, // 必填参数缺失
  PARAM_INVALID: 40002, // 参数格式非法（如日期不是 YYYY-MM-DD）
  DATE_FORMAT_INVALID: 40003, // 日期格式错误
  SLOT_INVALID: 40004, // 时间段取值非法
  SEAT_ROOM_MISMATCH: 40005, // 座位不属于该阅览室

  UNAUTHORIZED: 40101, // 未登录 / 身份无效（第二棒起接入登录态）

  ROUTE_NOT_FOUND: 40400, // 接口路径不存在
  ROOM_NOT_FOUND: 40401, // 阅览室不存在
  SEAT_NOT_FOUND: 40402, // 座位不存在
  RESERVATION_NOT_FOUND: 40403, // 预约记录不存在

  // ---- 4xxxx 业务冲突：可预期、需要给用户看的提示 ----
  SEAT_ALREADY_RESERVED: 40901, // 该座位在该时段已被预约
  DUPLICATE_RESERVATION: 40902, // 同一时段已有有效预约（重复预约）
  SEAT_DISABLED: 40903, // 座位已停用
  ROOM_CLOSED: 40904, // 阅览室未开放该时段
  TIME_EXPIRED: 40905, // 预约开始时间已过
  SEAT_OCCUPIED_BY_OTHERS: 40906, // 并发抢座失败（写库时触发唯一约束）

  // ---- 5xxxx 服务端错误（第二棒：签到/取消/详情）----
  CHECKIN_TIME_INVALID: 50001, // 不在签到时间窗口内
  NO_PENDING_RESERVATION: 50002, // 当前没有待签到的预约
  SEAT_NOT_MATCH: 50003, // 扫码座位与预约座位不一致
  RESERVATION_NOT_CANCELLABLE: 50004, // 当前状态不允许取消

  INTERNAL_ERROR: 50000, // 未知服务端异常
};

/** 错误码默认提示文案（前端可直接展示，也允许前端按 code 覆盖） */
const ERROR_MESSAGE = {
  [ERROR_CODE.PARAM_MISSING]: '缺少必填参数',
  [ERROR_CODE.PARAM_INVALID]: '参数格式不正确',
  [ERROR_CODE.DATE_FORMAT_INVALID]: '日期格式应为 YYYY-MM-DD',
  [ERROR_CODE.SLOT_INVALID]: '时间段只能是 MORNING / AFTERNOON / EVENING',
  [ERROR_CODE.SEAT_ROOM_MISMATCH]: '该座位不属于指定阅览室',
  [ERROR_CODE.UNAUTHORIZED]: '登录状态失效，请重新登录',
  [ERROR_CODE.ROUTE_NOT_FOUND]: '接口不存在',
  [ERROR_CODE.ROOM_NOT_FOUND]: '阅览室不存在',
  [ERROR_CODE.SEAT_NOT_FOUND]: '座位不存在',
  [ERROR_CODE.RESERVATION_NOT_FOUND]: '预约记录不存在',
  [ERROR_CODE.SEAT_ALREADY_RESERVED]: '该座位已被预约，请选择其他座位',
  [ERROR_CODE.DUPLICATE_RESERVATION]: '同一时段只能预约一个座位',
  [ERROR_CODE.SEAT_DISABLED]: '该座位已停用，暂时无法预约',
  [ERROR_CODE.ROOM_CLOSED]: '该时段不在阅览室开放时间内',
  [ERROR_CODE.TIME_EXPIRED]: '预约开始时间已过，无法预约该时段',
  [ERROR_CODE.SEAT_OCCUPIED_BY_OTHERS]: '手慢了，该座位刚刚被其他同学预约',
  [ERROR_CODE.CHECKIN_TIME_INVALID]: '不在签到时间窗口内（开始前 15 分钟至开始后 15 分钟）',
  [ERROR_CODE.NO_PENDING_RESERVATION]: '您当前没有待签到的预约',
  [ERROR_CODE.SEAT_NOT_MATCH]: '座位号不匹配',
  [ERROR_CODE.RESERVATION_NOT_CANCELLABLE]: '当前预约状态不允许取消',
  [ERROR_CODE.INTERNAL_ERROR]: '服务器开小差了，请稍后重试',
};

/** 业务码 → HTTP 状态码 */
function httpStatusOf(code) {
  if (code === ERROR_CODE.OK) return 200;
  if (code >= 50000) return code >= 50001 && code <= 50004 ? 409 : 500;
  if (code >= 40400 && code < 40500) return 404;
  if (code === ERROR_CODE.UNAUTHORIZED) return 401;
  if (code >= 40900) return 409;
  return 400;
}

module.exports = { ERROR_CODE, ERROR_MESSAGE, httpStatusOf };
