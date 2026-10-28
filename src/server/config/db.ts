import mongoose from "mongoose";
import { env } from "./env";
import { Student } from "../models/student.model";

export const connectDB = async (
  options: { maintenance?: boolean } = {},
): Promise<typeof mongoose> => {
  let conn: typeof mongoose;
  try {
    conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      ...(options.maintenance === false
        ? { autoIndex: false, autoCreate: false }
        : {}),
    });
  } catch (primaryError) {
    console.warn(
      "[Database] Primary MongoDB URI failed, attempting fallback local MongoDB...",
    );
    try {
      conn = await mongoose.connect(
        "mongodb://127.0.0.1:27017/acadivo_school_crm",
        {
          serverSelectionTimeoutMS: 5000,
          ...(options.maintenance === false
            ? { autoIndex: false, autoCreate: false }
            : {}),
        },
      );
    } catch (fallbackError) {
      console.error(
        "[Database] MongoDB Connection Error (Primary & Fallback):",
        primaryError,
      );
      throw primaryError;
    }
  }

  if (options.maintenance !== false)
    try {
      const studentIndexes = await Student.collection.indexes();
      const legacyRollIndex = studentIndexes.find(
        (index: any) => index.name === "schoolId_1_classId_1_rollNumber_1",
      );
      if (legacyRollIndex)
        await Student.collection.dropIndex(legacyRollIndex.name!);
      await Student.collection.createIndex(
        {
          schoolId: 1,
          academicSessionId: 1,
          classId: 1,
          sectionId: 1,
          rollNumber: 1,
        },
        { unique: true, name: "school_session_class_section_roll_unique" },
      );
    } catch (indexErr) {
      console.warn("[Database] Index setup warning:", indexErr);
    }

  console.log(
    `[Database] MongoDB Connected: ${conn.connection.host} (${conn.connection.name})`,
  );
  return conn;
};
