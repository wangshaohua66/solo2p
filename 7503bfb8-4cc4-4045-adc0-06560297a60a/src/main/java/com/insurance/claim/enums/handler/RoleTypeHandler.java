package com.insurance.claim.enums.handler;

import com.insurance.claim.enums.RoleType;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class RoleTypeHandler extends BaseTypeHandler<RoleType> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, RoleType parameter, JdbcType jdbcType) throws SQLException {
        ps.setInt(i, parameter.getCode());
    }

    @Override
    public RoleType getNullableResult(ResultSet rs, String columnName) throws SQLException {
        int code = rs.getInt(columnName);
        if (rs.wasNull()) {
            return null;
        }
        return RoleType.fromCode(code);
    }

    @Override
    public RoleType getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        int code = rs.getInt(columnIndex);
        if (rs.wasNull()) {
            return null;
        }
        return RoleType.fromCode(code);
    }

    @Override
    public RoleType getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        int code = cs.getInt(columnIndex);
        if (cs.wasNull()) {
            return null;
        }
        return RoleType.fromCode(code);
    }
}
