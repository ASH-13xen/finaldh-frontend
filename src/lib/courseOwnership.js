// Which courses the logged-in student owns, as lowercased courseIds.
//
// The server sends `ownedCourseIds` on every user payload, built from the same rule its download check
// uses - so a course listed here is always downloadable. Do not derive ownership from
// `interestedCourses`: that is only a list of enrollment labels, and showing courses from it is how
// students ended up seeing a course whose every download answered "Access denied".
export const ownedCourseIdList = (user) => {
  const list = Array.isArray(user?.ownedCourseIds)
    ? user.ownedCourseIds
    : // A backend that predates ownedCourseIds (frontend deployed first) - fall back to the old list.
      Array.isArray(user?.interestedCourses)
      ? user.interestedCourses
      : [];
  return list
    .filter((id) => typeof id === 'string' && id.trim() !== '')
    .map((id) => id.toLowerCase());
};

export const ownsCourse = (user, courseId) =>
  typeof courseId === 'string' && ownedCourseIdList(user).includes(courseId.toLowerCase());
